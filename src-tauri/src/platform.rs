//! Everything that differs between Linux and Windows lives here, so the
//! command modules stay platform-neutral.

use std::path::{Path, PathBuf};

/// Paths go to the frontend with `/` separators on every platform (Windows
/// accepts them everywhere), so path logic in the UI is written once.
pub fn path_str(p: &Path) -> String {
    let s = p.to_string_lossy();
    if cfg!(windows) {
        s.replace('\\', "/")
    } else {
        s.into_owned()
    }
}

/// `canonicalize` without Windows' `\\?\` verbatim prefix.
pub fn canonical(p: &Path) -> Option<PathBuf> {
    dunce::canonicalize(p).ok()
}

/// External processes (git, the agent's shell commands) must not flash a
/// console window on Windows.
pub fn command(program: impl AsRef<std::ffi::OsStr>) -> tokio::process::Command {
    #[allow(unused_mut)]
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[cfg_attr(not(windows), allow(dead_code))]
fn find_in_path(exe: &str) -> Option<PathBuf> {
    std::env::split_paths(&std::env::var_os("PATH")?).map(|d| d.join(exe)).find(|p| p.is_file())
}

/// Interactive shell for terminal tabs, with arguments.
pub fn interactive_shell() -> (String, Vec<String>) {
    #[cfg(windows)]
    {
        // PowerShell 7 if installed, else the built-in Windows PowerShell. The prompt is
        // wrapped to report the current directory with OSC 9;9 (the Windows Terminal
        // convention), which the explorer uses to follow `cd`.
        let exe = find_in_path("pwsh.exe").map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|| "powershell.exe".into());
        let hook = concat!(
            "$__traxPrompt = $function:prompt; ",
            "function global:prompt { ",
            "$l = $executionContext.SessionState.Path.CurrentLocation; ",
            "if ($l.Provider.Name -eq 'FileSystem') { [Console]::Write(\"$([char]27)]9;9;`\"$($l.ProviderPath)`\"$([char]27)\\\") }; ",
            "& $__traxPrompt }"
        );
        // -EncodedCommand (UTF-16LE base64) avoids any quoting trouble through ConPTY.
        (exe, vec!["-NoLogo".into(), "-NoExit".into(), "-EncodedCommand".into(), encode_ps(hook)])
    }
    #[cfg(not(windows))]
    {
        (std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into()), vec![])
    }
}

#[cfg_attr(not(windows), allow(dead_code))]
fn encode_ps(script: &str) -> String {
    use base64::Engine;
    let utf16: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    base64::engine::general_purpose::STANDARD.encode(utf16)
}

/// Program and leading arguments to run one non-interactive command line.
pub fn command_shell() -> (String, Vec<&'static str>) {
    #[cfg(windows)]
    {
        let exe = find_in_path("pwsh.exe").map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|| "powershell.exe".into());
        (exe, vec!["-NoProfile", "-NonInteractive", "-Command"])
    }
    #[cfg(not(windows))]
    {
        (std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into()), vec!["-lc"])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn powershell_encoding_is_utf16le_base64() {
        // "ls" → 6c 00 73 00
        assert_eq!(encode_ps("ls"), "bABzAA==");
    }

    #[test]
    fn paths_use_forward_slashes() {
        let p = Path::new("dir").join("file.txt");
        assert_eq!(path_str(&p), "dir/file.txt");
    }
}
