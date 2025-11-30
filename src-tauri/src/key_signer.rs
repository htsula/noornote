/**
 * KeySigner Tauri Commands
 * Handles communication with clistr-key-signer Unix socket daemon
 */

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use tauri::command;

#[cfg(unix)]
use std::os::unix::net::UnixStream;

/// Get socket path based on platform
fn get_socket_path() -> Result<PathBuf, String> {
    #[cfg(unix)]
    {
        let home = std::env::var("HOME")
            .map_err(|_| "Failed to get HOME directory".to_string())?;
        Ok(PathBuf::from(home).join(".noorsigner").join("noorsigner.sock"))
    }
    #[cfg(windows)]
    {
        // Named pipe path for Windows
        Ok(PathBuf::from(r"\\.\pipe\noorsigner"))
    }
}

/// Send JSON-RPC request to KeySigner daemon via Unix socket
#[command]
pub async fn key_signer_request(request: String) -> Result<String, String> {
    #[cfg(unix)]
    {
        use std::time::Duration;

        let socket_path = get_socket_path()?;

        // Connect to Unix socket
        let mut stream = UnixStream::connect(&socket_path)
            .map_err(|e| format!("Failed to connect to KeySigner daemon: {}. Is the daemon running?", e))?;

        // Set read/write timeouts (10 seconds)
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .map_err(|e| format!("Failed to set read timeout: {}", e))?;

        stream
            .set_write_timeout(Some(Duration::from_secs(10)))
            .map_err(|e| format!("Failed to set write timeout: {}", e))?;

        // Send request
        stream
            .write_all(request.as_bytes())
            .map_err(|e| format!("Failed to send request: {}", e))?;

        stream
            .write_all(b"\n")
            .map_err(|e| format!("Failed to send newline: {}", e))?;

        // Read response line-by-line (JSON response ends with \n)
        let mut reader = BufReader::new(&mut stream);
        let mut response = String::new();
        reader
            .read_line(&mut response)
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::TimedOut || e.kind() == std::io::ErrorKind::WouldBlock {
                    format!("Request timed out - daemon may have crashed or is unresponsive")
                } else {
                    format!("Failed to read response: {}", e)
                }
            })?;

        Ok(response.trim_end().to_string())
    }

    #[cfg(windows)]
    {
        // Windows Named Pipes implementation
        // TODO: Implement Windows named pipe support
        Err("Windows named pipes not yet implemented".to_string())
    }
}

/// Check if Trust Mode session is valid
#[command]
pub async fn check_trust_session() -> Result<bool, String> {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    let home = std::env::var("HOME")
        .map_err(|_| "Failed to get HOME directory".to_string())?;
    let trust_session_path = PathBuf::from(&home)
        .join(".noorsigner")
        .join("trust_session");

    // Check if trust session file exists
    if !trust_session_path.exists() {
        return Ok(false);
    }

    // Read trust session file
    let content = fs::read_to_string(&trust_session_path)
        .map_err(|e| format!("Failed to read trust session: {}", e))?;

    // Parse format: token:expires_unix:created_unix:encrypted_nsec_hex
    let parts: Vec<&str> = content.split(':').collect();
    if parts.len() != 4 {
        return Ok(false);
    }

    let expires_unix: i64 = parts[1]
        .parse()
        .map_err(|_| "Invalid expiry timestamp".to_string())?;

    // Check if still valid
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "Failed to get current time".to_string())?
        .as_secs() as i64;

    Ok(now < expires_unix)
}

/// Cancel KeySigner launch by killing any running noorsigner daemon process
/// This closes the terminal window where password entry is pending
#[command]
pub async fn cancel_key_signer_launch() -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::process::Command;

        // Find noorsigner daemon process and kill it
        // This will close the terminal window automatically
        let output = Command::new("pkill")
            .arg("-f")
            .arg("noorsigner.*daemon")
            .output()
            .map_err(|e| format!("Failed to kill noorsigner process: {}", e))?;

        if output.status.success() {
            println!("Killed noorsigner daemon process - terminal should close");
            Ok(())
        } else {
            // Process might not exist (user already closed terminal) - not an error
            println!("No noorsigner daemon process found to kill");
            Ok(())
        }
    }

    #[cfg(windows)]
    {
        use std::process::Command;

        // Windows: taskkill noorsigner
        let output = Command::new("taskkill")
            .arg("/F")
            .arg("/IM")
            .arg("noorsigner*.exe")
            .output()
            .map_err(|e| format!("Failed to kill noorsigner process: {}", e))?;

        if output.status.success() {
            println!("Killed noorsigner daemon process");
            Ok(())
        } else {
            println!("No noorsigner daemon process found to kill");
            Ok(())
        }
    }
}

/// Launch NoorSigner CLI binary
#[command]
pub async fn launch_key_signer(mode: String) -> Result<(), String> {
    use std::process::Command;

    let noorsigner_path = if cfg!(debug_assertions) {
        // Dev: self-compiled binary in ../noorsigner/
        let home = std::env::var("HOME")
            .map_err(|_| "Failed to get HOME directory".to_string())?;
        PathBuf::from(home).join("projects").join("noorsigner").join("noorsigner")
    } else {
        // Production: installed in /usr/local/bin/
        PathBuf::from("/usr/local/bin/noorsigner")
    };

    // Verify binary exists
    if !noorsigner_path.exists() {
        return Err(format!(
            "NoorSigner binary not found at: {}",
            noorsigner_path.display()
        ));
    }

    // Ensure binary is executable (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&noorsigner_path)
            .map_err(|e| format!("Failed to get binary permissions: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&noorsigner_path, perms)
            .map_err(|e| format!("Failed to set binary permissions: {}", e))?;
    }

    // Launch NoorSigner with appropriate command
    let command = match mode.as_str() {
        "init" => "init",
        "daemon" => "daemon",
        "add-account" => "add-account",
        _ => return Err(format!("Invalid mode: {}", mode)),
    };

    println!("Launching NoorSigner: {} {}", noorsigner_path.display(), command);

    // Check if Trust Mode is valid AND daemon is not already running
    // Trust session is only useful if daemon is NOT running yet
    let has_trust_session = check_trust_session().await.unwrap_or(false);

    // Also check if daemon is already running by checking socket existence
    let socket_path = get_socket_path()?;
    let daemon_already_running = socket_path.exists();

    println!("Trust session valid: {}", has_trust_session);
    println!("Daemon already running: {}", daemon_already_running);

    // Only use background launch if trust session exists AND daemon is not already running
    // If daemon is already running, no need to launch again
    if has_trust_session && !daemon_already_running && mode == "daemon" {
        // Trust session exists - try to run daemon in background (no terminal)
        println!("Trust session valid + daemon not running - attempting background launch...");

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            Command::new(&noorsigner_path)
                .arg(command)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .process_group(0) // Create new process group
                .spawn()
                .map_err(|e| format!("Failed to launch NoorSigner in background: {}", e))?;
        }

        #[cfg(windows)]
        {
            Command::new(&noorsigner_path)
                .arg(command)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
                .map_err(|e| format!("Failed to launch NoorSigner in background: {}", e))?;
        }

        println!("Background daemon launched - waiting for socket to appear...");

        // Wait for socket to appear (daemon startup validation)
        // If socket doesn't appear within 3 seconds, trust session is invalid
        use std::time::{Duration, Instant};
        let start = Instant::now();
        let timeout = Duration::from_secs(3);

        while start.elapsed() < timeout {
            if socket_path.exists() {
                println!("Socket appeared - daemon started successfully!");
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(100));
        }

        // Socket didn't appear - trust session is invalid or daemon failed to start
        println!("Socket did not appear - trust session likely invalid, falling back to terminal launch");

        // Delete invalid trust session
        let home = std::env::var("HOME")
            .map_err(|_| "Failed to get HOME directory".to_string())?;
        let trust_session_path = PathBuf::from(&home)
            .join(".noorsigner")
            .join("trust_session");

        if trust_session_path.exists() {
            let _ = std::fs::remove_file(&trust_session_path);
            println!("Removed invalid trust session file");
        }

        // Fall through to terminal launch (background launch failed)
    }

    // If we reach here: no trust session, init mode, or background launch failed
    // Open terminal for user input
    println!("Launching in terminal for user input");

        #[cfg(target_os = "macos")]
        {
            let terminal_command = format!("{} {}", noorsigner_path.display(), command);

            println!("=== DEBUG: Terminal command to execute ===");
            println!("Binary path: {}", noorsigner_path.display());
            println!("Command: {}", command);
            println!("Full terminal_command: {}", terminal_command);

            // Launch terminal with noorsigner
            // Use 'activate' BEFORE 'do script' to ensure Terminal.app is ready
            // This prevents silent failures when Terminal was previously closed
            let applescript = format!(
                "tell application \"Terminal\"\n\
                 activate\n\
                 do script \"{}\"\n\
                 end tell",
                terminal_command
            );

            println!("AppleScript:\n{}", applescript);

            let output = Command::new("osascript")
                .arg("-e")
                .arg(&applescript)
                .output()
                .map_err(|e| format!("Failed to launch Terminal.app: {}", e))?;

            // Check if osascript failed
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                println!("osascript FAILED!");
                println!("stderr: {}", stderr);
                println!("stdout: {}", stdout);
                return Err(format!("osascript failed: {}", stderr));
            }

            println!("Terminal.app launched successfully via osascript");
        }

        #[cfg(target_os = "linux")]
        {
            // Try common terminal emulators
            let terminals = ["gnome-terminal", "konsole", "xterm"];
            let mut launched = false;

            for terminal in &terminals {
                if let Ok(_) = Command::new(terminal)
                    .arg("-e")
                    .arg(noorsigner_path.to_str().unwrap())
                    .arg(command)
                    .spawn()
                {
                    launched = true;
                    break;
                }
            }

            if !launched {
                return Err("No terminal emulator found. Please install gnome-terminal, konsole, or xterm.".to_string());
            }
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .arg("/c")
                .arg("start")
                .arg(noorsigner_path.to_str().unwrap())
                .arg(command)
                .spawn()
                .map_err(|e| format!("Failed to launch NoorSigner: {}", e))?;
        }

    println!("NoorSigner launched successfully");

    Ok(())
}
