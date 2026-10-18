use std::path::{Path, PathBuf};

use ignore::WalkBuilder;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub(crate) name: String,
    path: String,
    is_dir: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrepMatch {
    path: String,
    line: usize,
    text: String,
}

const MAX_READ: u64 = 8 * 1024 * 1024;

#[tauri::command]
pub fn workspace_home() -> String {
    dirs::home_dir().map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|| "/".into())
}

/// First CLI argument that is a directory, else the process cwd (unless it is `/`).
#[tauri::command]
pub fn workspace_launch_dir() -> Option<String> {
    if let Some(arg) = std::env::args().skip(1).find(|a| Path::new(a).is_dir()) {
        return PathBuf::from(arg).canonicalize().ok().map(|d| d.to_string_lossy().into_owned());
    }
    let dir = std::env::current_dir().ok()?.canonicalize().ok()?;
    // Launched from the app menu the cwd is `/` or $HOME; the frontend then
    // reopens the most recent workspace instead.
    let home = dirs::home_dir().and_then(|h| h.canonicalize().ok());
    if dir == Path::new("/") || Some(&dir) == home.as_ref() || dir.ends_with("src-tauri") {
        return None;
    }
    Some(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn fs_read_dir(path: String, show_hidden: Option<bool>) -> Result<Vec<DirEntry>, String> {
    let show_hidden = show_hidden.unwrap_or(false);
    let mut out: Vec<DirEntry> = std::fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if !show_hidden && name.starts_with('.') {
                return None;
            }
            let path = e.path();
            // Follow symlinks so linked dirs expand like real ones.
            let is_dir = path.is_dir();
            Some(DirEntry { name, path: path.to_string_lossy().into_owned(), is_dir })
        })
        .collect();
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(out)
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_READ {
        return Err(format!("file too large ({} bytes)", meta.len()));
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    if bytes.iter().take(8000).any(|b| *b == 0) {
        return Err("binary file".into());
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
pub async fn fs_write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_create_file(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err("already exists".into());
    }
    std::fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_rename(from: String, to: String) -> Result<(), String> {
    if Path::new(&to).exists() {
        return Err("target already exists".into());
    }
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_delete(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

fn walker(root: &str) -> ignore::Walk {
    WalkBuilder::new(root).hidden(true).git_ignore(true).build()
}

/// Fuzzy (subsequence) file-name search across the workspace, gitignore-aware.
#[tauri::command]
pub async fn fs_search(root: String, query: String, limit: Option<usize>) -> Vec<String> {
    let limit = limit.unwrap_or(60);
    let q: Vec<char> = query.to_lowercase().chars().filter(|c| !c.is_whitespace()).collect();
    let mut scored: Vec<(i64, String)> = Vec::new();
    for entry in walker(&root).filter_map(|e| e.ok()) {
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let full = entry.path().to_string_lossy().into_owned();
        let rel = full.strip_prefix(&root).unwrap_or(&full).trim_start_matches('/').to_owned();
        if let Some(score) = fuzzy_score(&rel.to_lowercase(), &q) {
            scored.push((score, full));
        }
        if scored.len() > 20_000 {
            break;
        }
    }
    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.len().cmp(&b.1.len())));
    scored.into_iter().take(limit).map(|(_, p)| p).collect()
}

fn fuzzy_score(hay: &str, needle: &[char]) -> Option<i64> {
    if needle.is_empty() {
        return Some(0);
    }
    let file_start = hay.rfind('/').map(|i| i + 1).unwrap_or(0);
    let mut score = 0i64;
    let mut ni = 0;
    let mut prev: Option<usize> = None;
    for (i, c) in hay.char_indices() {
        if ni < needle.len() && c == needle[ni] {
            score += 1;
            if prev.map(|p| p + 1 == i).unwrap_or(false) {
                score += 4;
            }
            if i >= file_start {
                score += 2;
            }
            prev = Some(i);
            ni += 1;
        }
    }
    (ni == needle.len()).then_some(score)
}

/// Project-wide regex search. Literal unless `regex` is true.
#[tauri::command]
pub async fn fs_grep(
    root: String,
    query: String,
    regex: Option<bool>,
    case_sensitive: Option<bool>,
    limit: Option<usize>,
) -> Result<Vec<GrepMatch>, String> {
    let limit = limit.unwrap_or(500);
    let pattern = if regex.unwrap_or(false) { query } else { regex::escape(&query) };
    let re = regex::RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive.unwrap_or(false))
        .build()
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in walker(&root).filter_map(|e| e.ok()) {
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        if meta.len() > 2 * 1024 * 1024 {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
        for (i, line) in text.lines().enumerate() {
            if re.is_match(line) {
                let text: String = line.trim().chars().take(240).collect();
                out.push(GrepMatch { path: entry.path().to_string_lossy().into_owned(), line: i + 1, text });
                if out.len() >= limit {
                    return Ok(out);
                }
            }
        }
    }
    Ok(out)
}
