mod ai;
mod fs;
mod git;
mod platform;
mod pty;
mod shell;

/// Strings are streamed to the webview in chunks; a read can split a
/// multi-byte UTF-8 sequence, so the incomplete tail is carried over.
pub(crate) fn decode_utf8_carry(carry: &mut Vec<u8>, chunk: &[u8]) -> String {
    carry.extend_from_slice(chunk);
    match std::str::from_utf8(carry) {
        Ok(s) => {
            let out = s.to_owned();
            carry.clear();
            out
        }
        Err(e) => {
            let valid = e.valid_up_to();
            // error_len() == None means the tail is an incomplete sequence.
            let cut = match e.error_len() {
                None => valid,
                Some(_) => carry.len(),
            };
            let out = String::from_utf8_lossy(&carry[..cut]).into_owned();
            carry.drain(..cut);
            out
        }
    }
}

/// How this copy was installed, which decides how it can update itself:
/// an AppImage replaces its own file; a .deb belongs to the package manager.
#[tauri::command]
fn install_kind() -> &'static str {
    // The NSIS installer's updater swaps the app in place, like the AppImage.
    if cfg!(windows) {
        return "windows";
    }
    if std::env::var_os("APPIMAGE").is_some() {
        return "appimage";
    }
    match std::env::current_exe() {
        Ok(exe) if exe.starts_with("/usr") => "deb",
        _ => "manual",
    }
}

/// Forwards webview errors to stdout so they are visible without devtools.
#[tauri::command]
fn log_js(level: String, message: String) {
    eprintln!("[webview:{level}] {message}");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .on_page_load(|webview, payload| {
            if cfg!(debug_assertions) {
                eprintln!("[page] {:?} {} ({})", payload.event(), payload.url(), webview.label());
            }
        })
        .manage(pty::PtyState::default())
        .manage(ai::AiState::default())
        .invoke_handler(tauri::generate_handler![
            log_js,
            install_kind,
            pty::pty_open,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_close,
            pty::pty_cwd,
            fs::workspace_home,
            fs::workspace_launch_dir,
            fs::fs_read_dir,
            fs::fs_read_file,
            fs::fs_write_file,
            fs::fs_create_file,
            fs::fs_create_dir,
            fs::fs_rename,
            fs::fs_delete,
            fs::fs_search,
            fs::fs_grep,
            fs::fs_stat,
            fs::fs_read_base64,
            fs::media_allow,
            fs::open_default,
            git::git_status,
            git::git_diff,
            git::git_file_at_head,
            git::git_stage,
            git::git_unstage,
            git::git_discard,
            git::git_commit,
            git::git_push,
            git::git_log,
            git::git_branch,
            git::git_show,
            git::git_apply,
            shell::shell_run,
            ai::ai_stream,
            ai::ai_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf8_carry_joins_split_sequences() {
        let mut carry = Vec::new();
        let bytes = "olá ✓".as_bytes();
        let (a, b) = bytes.split_at(bytes.len() - 1);
        assert_eq!(decode_utf8_carry(&mut carry, a), "olá ");
        assert_eq!(decode_utf8_carry(&mut carry, b), "✓");
        assert!(carry.is_empty());
    }

    fn sh(dir: &std::path::Path, cmd: &str) {
        let ok = std::process::Command::new("sh").arg("-c").arg(cmd).current_dir(dir).status().unwrap().success();
        assert!(ok, "{cmd}");
    }

    #[tokio::test]
    async fn fs_search_grep_and_git_roundtrip() {
        let tmp = std::env::temp_dir().join(format!("t-rax-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(tmp.join("src")).unwrap();
        let root = tmp.to_string_lossy().into_owned();
        let p = |s: &str| tmp.join(s).to_string_lossy().into_owned();

        fs::fs_write_file(p("src/main.ts"), "const greeting = 'hello';\n".into()).await.unwrap();
        fs::fs_write_file(p("my file.md"), "# Hello world\n".into()).await.unwrap();
        let entries = fs::fs_read_dir(root.clone(), None).await.unwrap();
        assert_eq!(entries.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(), ["src", "my file.md"]);

        let found = fs::fs_search(root.clone(), "mts".into(), None).await;
        assert!(found[0].ends_with("src/main.ts"), "{found:?}");
        let hits = fs::fs_grep(root.clone(), "hello".into(), None, None, None).await.unwrap();
        assert_eq!(hits.len(), 2);

        sh(&tmp, "git init -q -b main && git config user.email t@t && git config user.name t && git add -A && git commit -qm init");
        assert!(git::git_status(p("src")).await.unwrap().is_some());
        std::fs::write(tmp.join("src/main.ts"), "const greeting = 'hi';\nconst x = 1;\n").unwrap();
        std::fs::write(tmp.join("new.txt"), "n\n").unwrap();
        let st = git::git_status(root.clone()).await.unwrap().unwrap();
        let mut ch: Vec<_> = st.changes.iter().map(|c| format!("{}{}{}", c.status, if c.staged { "+" } else { "" }, c.path)).collect();
        ch.sort();
        assert_eq!(ch, ["?new.txt", "Msrc/main.ts"]);
        assert_eq!(st.branch, "main");

        // Stage a single hunk via git apply --cached.
        let diff = git::git_diff(root.clone(), "src/main.ts".into(), false).await.unwrap();
        git::git_apply(root.clone(), diff, true, false).await.unwrap();
        let st = git::git_status(root.clone()).await.unwrap().unwrap();
        assert!(st.changes.iter().any(|c| c.staged && c.path == "src/main.ts"));

        git::git_commit(root.clone(), "second".into(), true).await.unwrap();
        let log = git::git_log(root.clone(), None, None).await.unwrap();
        assert_eq!(log.len(), 2);
        assert_eq!(log[0].subject, "second");
        assert_eq!(log[0].parents, [log[1].hash.clone()]);
        assert!(log[0].refs.iter().any(|r| r.contains("main")));

        let r = shell::shell_run("echo out; echo err >&2; exit 3".into(), root.clone(), Some(5)).await.unwrap();
        assert_eq!((r.stdout.trim(), r.stderr.trim(), r.code), ("out", "err", Some(3)));
        let r = shell::shell_run("sleep 5".into(), root.clone(), Some(1)).await.unwrap();
        assert!(r.timed_out);

        std::fs::remove_dir_all(&tmp).unwrap();
    }
}
