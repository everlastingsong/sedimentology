use std::process::Command;
use std::process::Stdio;

pub fn sha256sum(file_path: &str) -> String {
    let output = Command::new("sha256sum")
        .arg(file_path)
        .stdout(Stdio::piped())
        .output()
        .expect("failed to execute sha256sum");
    let output = String::from_utf8(output.stdout).unwrap();
    let output = output.split(" ").collect::<Vec<&str>>();
    return output[0].to_string();
}

pub fn rclone_copyto(src: &str, dst: &str) {
    let status = Command::new("rclone")
        .arg("copyto")
        .arg("--retries=10") // 10 retries
        .arg("--retries-sleep=60s") // retry interval 60s
        .arg(src)
        .arg(dst)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .status()
        .expect("failed to execute rclone");
    assert!(status.success());
}