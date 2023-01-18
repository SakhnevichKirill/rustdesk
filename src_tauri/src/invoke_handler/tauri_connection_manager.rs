use hbb_common::tokio::sync::mpsc;

use crate::{
    ui::cm::TauriConnectionManager, 
};

use std::{sync::Mutex};

#[tauri::command(async)]
pub fn check_click_time(id: i32, tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) {
    tauri_connection.lock().unwrap().check_click_time(id)
}

#[tauri::command(async)]
pub fn get_click_time(tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) -> f64 {
    tauri_connection.lock().unwrap().get_click_time()
}

#[tauri::command(async)]
pub fn switch_permission(id: i32, name: String, enabled: bool, tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) {
    tauri_connection.lock().unwrap().switch_permission(id, name, enabled)
}

#[tauri::command(async)]
pub fn close(id: i32, tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) {
    tauri_connection.lock().unwrap().close(id)
}

#[tauri::command(async)]
pub fn remove_disconnected_connection(id: i32, tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) {
    tauri_connection.lock().unwrap().remove_disconnected_connection(id)
}

#[tauri::command(async)]
pub fn quit(tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) {
    tauri_connection.lock().unwrap().quit()
}

#[tauri::command(async)]
pub fn authorize(id: i32, tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) {
    tauri_connection.lock().unwrap().authorize(id)
}

#[tauri::command(async)]
pub fn send_msg(id: i32, text: String, tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) {
    tauri_connection.lock().unwrap().send_msg(id, text)
}

#[tauri::command(async)]
pub fn can_elevate(tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) -> bool {
    tauri_connection.lock().unwrap().can_elevate()
}


#[tauri::command(async)]
pub fn elevate_portable(id: i32, tauri_connection: tauri::State<Mutex<TauriConnectionManager>>) {
    tauri_connection.lock().unwrap().elevate_portable(id)
}
