use serde::Serialize;
use std::time::Duration;
use tokio::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub(crate) stdout: String,
    pub(crate) stderr: String,
    pub(crate) code: Option<i32>,
    pub(crate) timed_out: bool,
}

const MAX_OUT: usize = 64 * 1024;

fn clip(bytes: &[u8]) -> String {
    let s = String::from_utf8_lossy(bytes);
    if s.len() <= MAX_OUT {
        return s.into_owned();
    }
    let mut cut = s.len() - MAX_OUT;
    while !s.is_char_boundary(cut) {
        cut += 1;
    }
    format!("…[truncated]\n{}", &s[cut..])
}

/// Non-interactive command used by AI agents (`run_command` tool).
#[tauri::command]
pub async fn shell_run(command: String, cwd: String, timeout_secs: Option<u64>) -> Result<RunResult, String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
    let child = Command::new(shell)
        .arg("-lc")
        .arg(&command)
        .current_dir(&cwd)
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true)
        .output();
    match tokio::time::timeout(Duration::from_secs(timeout_secs.unwrap_or(120)), child).await {
        Ok(out) => {
            let out = out.map_err(|e| e.to_string())?;
            Ok(RunResult { stdout: clip(&out.stdout), stderr: clip(&out.stderr), code: out.status.code(), timed_out: false })
        }
        Err(_) => Ok(RunResult { stdout: String::new(), stderr: "command timed out".into(), code: None, timed_out: true }),
    }
}
