use serde::Serialize;
use tokio::process::Command;

async fn git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_owned();
        Err(if err.is_empty() { format!("git {} failed", args.join(" ")) } else { err })
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub(crate) path: String,
    /// One of M A D R ? U
    pub(crate) status: String,
    pub(crate) staged: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub(crate) root: String,
    pub(crate) branch: String,
    pub(crate) upstream: Option<String>,
    pub(crate) ahead: u32,
    pub(crate) behind: u32,
    pub(crate) changes: Vec<FileChange>,
}

/// Returns None when `cwd` is not inside a repository.
#[tauri::command]
pub async fn git_status(cwd: String) -> Result<Option<GitStatus>, String> {
    let Ok(root) = git(&cwd, &["rev-parse", "--show-toplevel"]).await else {
        return Ok(None);
    };
    let root = root.trim().to_owned();
    let raw = git(&root, &["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all"]).await?;
    let mut st = GitStatus { root, branch: "HEAD".into(), upstream: None, ahead: 0, behind: 0, changes: vec![] };
    let mut parts = raw.split('\0').peekable();
    while let Some(rec) = parts.next() {
        if let Some(h) = rec.strip_prefix("# branch.head ") {
            st.branch = h.to_owned();
        } else if let Some(u) = rec.strip_prefix("# branch.upstream ") {
            st.upstream = Some(u.to_owned());
        } else if let Some(ab) = rec.strip_prefix("# branch.ab ") {
            for t in ab.split(' ') {
                if let Some(n) = t.strip_prefix('+') {
                    st.ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = t.strip_prefix('-') {
                    st.behind = n.parse().unwrap_or(0);
                }
            }
        } else if let Some(p) = rec.strip_prefix("? ") {
            st.changes.push(FileChange { path: p.to_owned(), status: "?".into(), staged: false });
        } else if rec.starts_with("1 ") || rec.starts_with("2 ") || rec.starts_with("u ") {
            let fields: Vec<&str> = rec.splitn(if rec.starts_with('1') { 9 } else if rec.starts_with('2') { 10 } else { 11 }, ' ').collect();
            let xy: Vec<char> = fields[1].chars().collect();
            let path = fields.last().copied().unwrap_or_default().to_owned();
            if rec.starts_with('2') {
                // Renames carry the original path as the next NUL record.
                parts.next();
            }
            if rec.starts_with('u') {
                st.changes.push(FileChange { path, status: "U".into(), staged: false });
                continue;
            }
            if xy[0] != '.' {
                st.changes.push(FileChange { path: path.clone(), status: xy[0].to_string(), staged: true });
            }
            if xy[1] != '.' {
                st.changes.push(FileChange { path, status: xy[1].to_string(), staged: false });
            }
        }
    }
    Ok(Some(st))
}

#[tauri::command]
pub async fn git_diff(root: String, path: String, staged: bool) -> Result<String, String> {
    if staged {
        git(&root, &["diff", "--cached", "--", &path]).await
    } else {
        git(&root, &["diff", "--", &path]).await
    }
}

/// File contents at a revision ("HEAD" or ":" for the index). Empty if absent.
#[tauri::command]
pub async fn git_file_at_head(root: String, path: String, rev: Option<String>) -> Result<String, String> {
    let rev = rev.unwrap_or_else(|| "HEAD".into());
    let spec = if rev == ":" { format!(":{path}") } else { format!("{rev}:{path}") };
    Ok(git(&root, &["show", &spec]).await.unwrap_or_default())
}

#[tauri::command]
pub async fn git_stage(root: String, paths: Vec<String>) -> Result<(), String> {
    let mut args = vec!["add", "-A", "--"];
    args.extend(paths.iter().map(String::as_str));
    git(&root, &args).await.map(|_| ())
}

#[tauri::command]
pub async fn git_unstage(root: String, paths: Vec<String>) -> Result<(), String> {
    let mut args = vec!["restore", "--staged", "--"];
    args.extend(paths.iter().map(String::as_str));
    git(&root, &args).await.map(|_| ())
}

/// Discards worktree changes; untracked files are removed.
#[tauri::command]
pub async fn git_discard(root: String, path: String, untracked: bool) -> Result<(), String> {
    if untracked {
        git(&root, &["clean", "-f", "--", &path]).await.map(|_| ())
    } else {
        git(&root, &["restore", "--", &path]).await.map(|_| ())
    }
}

#[tauri::command]
pub async fn git_commit(root: String, message: String, all: bool) -> Result<String, String> {
    if all {
        git(&root, &["add", "-A"]).await?;
    }
    git(&root, &["commit", "-m", &message]).await
}

#[tauri::command]
pub async fn git_push(root: String) -> Result<String, String> {
    let has_upstream = git(&root, &["rev-parse", "--abbrev-ref", "@{u}"]).await.is_ok();
    if has_upstream {
        git(&root, &["push"]).await
    } else {
        git(&root, &["push", "-u", "origin", "HEAD"]).await
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub(crate) hash: String,
    pub(crate) parents: Vec<String>,
    pub(crate) author: String,
    pub(crate) date: i64,
    pub(crate) subject: String,
    pub(crate) refs: Vec<String>,
}

#[tauri::command]
pub async fn git_log(root: String, limit: Option<u32>, query: Option<String>) -> Result<Vec<Commit>, String> {
    let n = format!("-n{}", limit.unwrap_or(300));
    let fmt = "--pretty=format:%H\x1f%P\x1f%an\x1f%at\x1f%D\x1f%s\x1e";
    let mut args = vec!["log", "--all", "--topo-order", &n, fmt];
    let grep;
    if let Some(q) = query.as_deref().filter(|q| !q.is_empty()) {
        grep = format!("--grep={q}");
        args.push("-i");
        args.push(&grep);
    }
    let raw = match git(&root, &args).await {
        Ok(r) => r,
        // Fresh repos have no HEAD yet.
        Err(e) if e.contains("does not have any commits") => return Ok(vec![]),
        Err(e) => return Err(e),
    };
    Ok(raw
        .split('\x1e')
        .filter_map(|rec| {
            let f: Vec<&str> = rec.trim_start_matches('\n').split('\x1f').collect();
            if f.len() < 6 {
                return None;
            }
            Some(Commit {
                hash: f[0].to_owned(),
                parents: f[1].split(' ').filter(|s| !s.is_empty()).map(str::to_owned).collect(),
                author: f[2].to_owned(),
                date: f[3].parse().unwrap_or(0),
                refs: f[4].split(", ").filter(|s| !s.is_empty()).map(str::to_owned).collect(),
                subject: f[5].to_owned(),
            })
        })
        .collect())
}

#[tauri::command]
pub async fn git_branch(cwd: String) -> Option<String> {
    git(&cwd, &["rev-parse", "--abbrev-ref", "HEAD"]).await.ok().map(|s| s.trim().to_owned())
}

#[tauri::command]
pub async fn git_show(root: String, hash: String) -> Result<String, String> {
    git(&root, &["show", "--stat", "--patch", "--format=%H%n%an <%ae>%n%ad%n%n%B", &hash]).await
}

/// Applies a single-hunk patch: stage (`cached`), unstage (`cached`+`reverse`)
/// or discard (`reverse` on the worktree).
#[tauri::command]
pub async fn git_apply(root: String, patch: String, cached: bool, reverse: bool) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;
    let mut args = vec!["apply", "--whitespace=nowarn"];
    if cached {
        args.push("--cached");
    }
    if reverse {
        args.push("--reverse");
    }
    args.push("-");
    let mut child = Command::new("git")
        .args(&args)
        .current_dir(&root)
        .stdin(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    child.stdin.take().unwrap().write_all(patch.as_bytes()).await.map_err(|e| e.to_string())?;
    let out = child.wait_with_output().await.map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_owned())
    }
}
