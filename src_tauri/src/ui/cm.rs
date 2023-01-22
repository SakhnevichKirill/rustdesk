#[cfg(target_os = "linux")]
use crate::ipc::start_pa;
use crate::ui_cm_interface::{start_ipc, ConnectionManager, InvokeUiCM};
use tauri::Manager;

use hbb_common::{allow_err, log};
use std::sync::Mutex;
use std::{ops::Deref, sync::Arc};

use serde::{Deserialize, Serialize};

use super::get_app_handle;
#[derive(Clone, Default, Debug, Serialize, Deserialize)]
pub struct TauriHandler;

impl InvokeUiCM for TauriHandler {
    fn add_connection(&self, client: &crate::ui_cm_interface::Client) {
        self.call_tauri("addConnection", (
            client.id,
            client.is_file_transfer,
            client.port_forward.clone(),
            client.peer_id.clone(),
            client.name.clone(),
            client.authorized,
            client.keyboard,
            client.clipboard,
            client.audio,
            client.file,
            client.restart,
            client.recording
        ));
    }

    fn remove_connection(&self, id: i32, close: bool) {
        self.call_tauri("removeConnection", (id, close));
        if crate::ui_cm_interface::get_clients_length().eq(&0) {
            crate::platform::quit_gui();
        }
    }

    fn new_message(&self, id: i32, text: String) {
        self.call_tauri("newMessage", (id, text));
    }

    fn change_theme(&self, _dark: String) {
        // TODO
    }

    fn change_language(&self) {
        // TODO
    }

    fn show_elevation(&self, show: bool) {
        self.call_tauri("showElevation", show);
    }
}

impl TauriHandler {
    #[inline]
    fn call_tauri<S: Serialize + Clone>(&self, event: &str, payload: S) {
        let app_handle = get_app_handle();
        match app_handle {
            Some(app) => {
                let window = app.get_window("cm").unwrap();
                window.emit(event, payload).unwrap();
            }
            None => {
                log::info!("Waiting to get app handle for macro to execute...");
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TauriConnectionManager(ConnectionManager<TauriHandler>);

impl Deref for TauriConnectionManager {
    type Target = ConnectionManager<TauriHandler>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl TauriConnectionManager {
    pub fn new() -> Self {
        #[cfg(target_os = "linux")]
        std::thread::spawn(start_pa);
        let cm = ConnectionManager {
            ui_handler: TauriHandler::default(),
        };
        let cloned = cm.clone();
        std::thread::spawn(move || start_ipc(cloned));
        TauriConnectionManager(cm)
    }

    fn get_icon(&mut self) -> String {
        crate::get_icon()
    }

    pub fn check_click_time(&mut self, id: i32) {
        crate::ui_cm_interface::check_click_time(id);
    }

    pub fn get_click_time(&self) -> f64 {
        crate::ui_cm_interface::get_click_time() as _
    }

    pub fn switch_permission(&self, id: i32, name: String, enabled: bool) {
        crate::ui_cm_interface::switch_permission(id, name, enabled);
    }

    pub fn close(&self, id: i32) {
        crate::ui_cm_interface::close(id);
    }

    pub fn remove_disconnected_connection(&self, id: i32) {
        crate::ui_cm_interface::remove(id);
    }

    pub fn quit(&self) {
        crate::platform::quit_gui();
    }

    pub fn authorize(&self, id: i32) {
        crate::ui_cm_interface::authorize(id);
    }

    pub fn send_msg(&self, id: i32, text: String) {
        crate::ui_cm_interface::send_chat(id, text);
    }

    fn t(&self, name: String) -> String {
        crate::client::translate(name)
    }

    pub fn can_elevate(&self) -> bool {
        crate::ui_cm_interface::can_elevate()
    }

    pub fn elevate_portable(&self, id: i32) {
        crate::ui_cm_interface::elevate_portable(id);
    }

    pub fn get_option(&self, key: String) -> String {
        crate::ui_interface::get_option(key)
    }
}