
use hbb_common::{
    config::{self, Config, PeerConfig, RENDEZVOUS_PORT, RENDEZVOUS_TIMEOUT},
    futures::future::join_all,
    log,
    protobuf::Message as _,
    rendezvous_proto::*,
    tcp::FramedStream,
    tokio,
};

use std::{
    collections::HashMap,
    process::Child,
    sync::{Arc, Mutex}, 
    error::Error,
};

use tauri::Manager;
#[cfg(windows)]
use winapi::ctypes::c_void;

use crate::common::get_app_name;
use crate::ipc;
use crate::ui_interface::*;

pub type Childs = Arc<Mutex<(bool, HashMap<(String, String), Child>)>>;

pub mod cm;
#[cfg(feature = "inline")]
pub mod inline;
#[cfg(target_os = "macos")]
mod macos;
pub mod remote;
#[cfg(target_os = "windows")]
pub mod win_privacy;

type Message = RendezvousMessage;

pub type Children = Arc<Mutex<(bool, HashMap<(String, String), Child>)>>;
#[allow(dead_code)]
type Status = (i32, bool, i64, String);

lazy_static::lazy_static! {
    static ref APPHANDLE: Arc<Mutex<Option<tauri::AppHandle>>> = Default::default();
}

struct UIHostHandler;

pub fn get_app_handle() -> Option<tauri::AppHandle> {
    APPHANDLE.lock().unwrap().clone()
}

fn set_app_handle(app_handle: tauri::AppHandle) {
    *APPHANDLE.lock().unwrap() = Some(app_handle);
}

pub fn create_main_window(app: &tauri::AppHandle) -> tauri::Window {
    tauri::Window::builder(app, "main", tauri::WindowUrl::App("index.html".into()))
        .title("Rustdesk")
        .inner_size(700f64, 600f64)
        .center()
        .build()
        .unwrap()
}

fn create_remote_window(app: &tauri::AppHandle, id: &String) -> tauri::Window {
    tauri::Window::builder(app, "remote", tauri::WindowUrl::App("index.html".into()))
        .title(id)
        .inner_size(700f64, 600f64)
        .center()
        .build()
        .unwrap()
}

pub fn show_remote_window(app: &tauri::AppHandle) {
    if let Some(remote_window) = app.get_window("remote") {
        remote_window.show().unwrap();
        remote_window.unminimize().unwrap();
        remote_window.set_focus().unwrap();
    } else {
        create_remote_window(app, &"Undef".to_string());
    }
}

#[cfg(windows)]
pub fn get_hwnd(window: impl raw_window_handle::HasRawWindowHandle) -> Result<*mut c_void, Box<dyn Error>> {
    match window.raw_window_handle() {
        #[cfg(target_os = "windows")]
        raw_window_handle::RawWindowHandle::Win32(handle) => {
            return Ok(handle.hwnd)
        }
        _ => Err("\"clear_acrylic()\" is only available on Windows 10 v1809 or newer and Windows 11.").map_err(Into::into),
    }
}

pub fn start(app: &tauri::AppHandle, args: &mut [String]) {
    set_app_handle(app.clone());
    #[cfg(target_os = "macos")]
    macos::show_dock();
    #[cfg(all(windows, not(feature = "inline")))]
    unsafe {
        winapi::um::shellscalingapi::SetProcessDpiAwareness(2); // PROCESS_PER_MONITOR_DPI_AWARE
    }
    let page;
    if args.len() > 1 && args[0] == "--play" {
        args[0] = "--connect".to_owned();
        let path: std::path::PathBuf = (&args[1]).into();
        let id = path
            .file_stem()
            .map(|p| p.to_str().unwrap_or(""))
            .unwrap_or("")
            .to_owned();
        args[1] = id;
    }
    if args.is_empty() {
        let children: Children = Default::default();
        std::thread::spawn(move || check_zombie(children));
        // TODO:
        //  crate::common::check_software_update();
        page = "index.html";
        create_main_window(app);
        app.get_window("main").unwrap().open_devtools();

    } else if args[0] == "--install" {
        page = "install.html";
    } else if args[0] == "--cm" {
        // Implemetation "connection-manager" behavior using tauri state manager
        app.manage(Mutex::new(cm::TauriConnectionManager::new())); //TODO: Move app to static
        page = "cm.html";
    } else if (args[0] == "--connect"
        || args[0] == "--file-transfer"
        || args[0] == "--port-forward"
        || args[0] == "--rdp")
        && args.len() > 1
    {
        let mut iter = args.iter();
        let cmd = iter.next().unwrap().clone();
        let id = iter.next().unwrap().clone();
        let pass = iter.next().unwrap_or(&"".to_owned()).clone();
        let args: Vec<String> = iter.map(|x| x.clone()).collect();
        let remote = create_remote_window(&app, &id);
        #[cfg(windows)]
        {
            let hw = get_hwnd(remote).unwrap();
            // below copied from https://github.com/TigerVNC/tigervnc/blob/master/vncviewer/win32.c
            crate::platform::windows::enable_lowlevel_keyboard(hw as _);
        }
        // Implemetation "native-remote" behavior using tauri state manager
        app.manage(Mutex::new(remote::TauriSession::new(
            cmd.clone(),
            id.clone(),
            pass.clone(),
            args.clone(),
        )));
        page = "remote.html";
    } else {
        log::error!("Wrong command: {:?}", args);
        return;
    }
    #[cfg(feature = "inline")]
    {
        let html = if page == "index.html" {
            inline::get_index()
        } else if page == "cm.html" {
            inline::get_cm()
        } else if page == "install.html" {
            inline::get_install()
        } else {
            inline::get_remote()
        };
        frame.load_html(html.as_bytes(), Some(page));
    }
    log::info!("page: {} args:{:?}", page, args);
    // #[cfg(not(feature = "inline"))]
    // window.load_file(&format!(
    //     "file://{}/src/ui/{}",
    //     std::env::current_dir()
    //         .map(|c| c.display().to_string())
    //         .unwrap_or("".to_owned()),
    //     page
    // ));
    // frame.run_app();
}

// // TODO: to handler
// fn get_sound_inputs(&self) -> Value {
//     Value::from_iter(get_sound_inputs())
// }
// fn change_id(&self, id: String) {
//     let old_id = self.get_id();
//     change_id(id, old_id);
// }

pub fn check_zombie(children: Children) {
    let mut deads = Vec::new();
    loop {
        let mut lock = children.lock().unwrap();
        let mut n = 0;
        for (id, c) in lock.1.iter_mut() {
            if let Ok(Some(_)) = c.try_wait() {
                deads.push(id.clone());
                n += 1;
            }
        }
        for ref id in deads.drain(..) {
            lock.1.remove(id);
        }
        if n > 0 {
            lock.0 = true;
        }
        drop(lock);
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

#[cfg(not(target_os = "linux"))]
fn get_sound_inputs() -> Vec<String> {
    let mut out = Vec::new();
    use cpal::traits::{DeviceTrait, HostTrait};
    let host = cpal::default_host();
    if let Ok(devices) = host.devices() {
        for device in devices {
            if device.default_input_config().is_err() {
                continue;
            }
            if let Ok(name) = device.name() {
                out.push(name);
            }
        }
    }
    out
}

#[cfg(target_os = "linux")]
fn get_sound_inputs() -> Vec<String> {
    crate::platform::linux::get_pa_sources()
        .drain(..)
        .map(|x| x.1)
        .collect()
}

const INVALID_FORMAT: &'static str = "Invalid format";
const UNKNOWN_ERROR: &'static str = "Unknown error";

#[tokio::main(flavor = "current_thread")]
async fn change_id(id: String, old_id: String) -> &'static str {
    if !hbb_common::is_valid_custom_id(&id) {
        return INVALID_FORMAT;
    }
    let uuid = machine_uid::get().unwrap_or("".to_owned());
    if uuid.is_empty() {
        return UNKNOWN_ERROR;
    }
    let rendezvous_servers = crate::ipc::get_rendezvous_servers(1_000).await;
    let mut futs = Vec::new();
    let err: Arc<Mutex<&str>> = Default::default();
    for rendezvous_server in rendezvous_servers {
        let err = err.clone();
        let id = id.to_owned();
        let uuid = uuid.clone();
        let old_id = old_id.clone();
        futs.push(tokio::spawn(async move {
            let tmp = check_id(rendezvous_server, old_id, id, uuid).await;
            if !tmp.is_empty() {
                *err.lock().unwrap() = tmp;
            }
        }));
    }
    join_all(futs).await;
    let err = *err.lock().unwrap();
    if err.is_empty() {
        crate::ipc::set_config_async("id", id.to_owned()).await.ok();
    }
    err
}

async fn check_id(
    rendezvous_server: String,
    old_id: String,
    id: String,
    uuid: String,
) -> &'static str {
    let any_addr = Config::get_any_listen_addr();
    if let Ok(mut socket) = FramedStream::new(
        crate::check_port(rendezvous_server, RENDEZVOUS_PORT),
        any_addr,
        RENDEZVOUS_TIMEOUT,
    )
    .await
    {
        let mut msg_out = Message::new();
        msg_out.set_register_pk(RegisterPk {
            old_id,
            id,
            uuid: uuid.into(),
            ..Default::default()
        });
        let mut ok = false;
        if socket.send(&msg_out).await.is_ok() {
            if let Some(Ok(bytes)) = socket.next_timeout(3_000).await {
                if let Ok(msg_in) = RendezvousMessage::parse_from_bytes(&bytes) {
                    match msg_in.union {
                        Some(rendezvous_message::Union::RegisterPkResponse(rpr)) => {
                            match rpr.result.enum_value_or_default() {
                                register_pk_response::Result::OK => {
                                    ok = true;
                                }
                                register_pk_response::Result::ID_EXISTS => {
                                    return "Not available";
                                }
                                register_pk_response::Result::TOO_FREQUENT => {
                                    return "Too frequent";
                                }
                                register_pk_response::Result::NOT_SUPPORT => {
                                    return "server_not_support";
                                }
                                register_pk_response::Result::INVALID_ID_FORMAT => {
                                    return INVALID_FORMAT;
                                }
                                _ => {}
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
        if !ok {
            return UNKNOWN_ERROR;
        }
    } else {
        return "Failed to connect to rendezvous server";
    }
    ""
}