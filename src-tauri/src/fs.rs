use std::path::{Path, PathBuf};

use ignore::WalkBuilder;
use serde::Serialize;

use crate::platform::{canonical, path_str};

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
    dirs::home_dir().map(|p| path_str(&p)).unwrap_or_else(|| "/".into())
}

/// First CLI argument that is a directory, else the process cwd (unless it is `/`).
#[tauri::command]
pub fn workspace_launch_dir() -> Option<String> {
    if let Some(arg) = std::env::args().skip(1).find(|a| Path::new(a).is_dir()) {
        return canonical(&PathBuf::from(arg)).map(|d| path_str(&d));
    }
    let dir = canonical(&std::env::current_dir().ok()?)?;
    // Launched from the app menu the cwd is `/` or $HOME; the frontend then
    // reopens the most recent workspace instead.
    let home = dirs::home_dir().and_then(|h| canonical(&h));
    if dir == Path::new("/") || Some(&dir) == home.as_ref() || dir.ends_with("src-tauri") {
        return None;
    }
    Some(path_str(&dir))
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
            Some(DirEntry { name, path: path_str(&path), is_dir })
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
        let full = path_str(entry.path());
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
                out.push(GrepMatch { path: path_str(entry.path()), line: i + 1, text });
                if out.len() >= limit {
                    return Ok(out);
                }
            }
        }
    }
    Ok(out)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    size: u64,
    /// Milliseconds since the Unix epoch; used to reload viewers when a file changes.
    modified: u64,
    is_dir: bool,
}

#[tauri::command]
pub async fn fs_stat(path: String) -> Result<FileStat, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(FileStat { size: meta.len(), modified, is_dir: meta.is_dir() })
}

/// Lets the webview load exactly this file through the asset protocol (image and
/// PDF viewers), instead of exposing whole directories up front.
#[tauri::command]
pub fn media_allow(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri::Manager;
    if !Path::new(&path).is_file() {
        return Err("not a file".into());
    }
    app.asset_protocol_scope().allow_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_default(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

/// File contents as base64, for attaching images to an agent message.
#[tauri::command]
pub async fn fs_read_base64(path: String, max_bytes: u64) -> Result<String, String> {
    use base64::Engine;
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > max_bytes {
        return Err(format!("file too large ({} MB, limit {} MB)", meta.len() / 1_048_576, max_bytes / 1_048_576));
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}
