use std::collections::HashMap;
use std::sync::Mutex;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;
use tokio::sync::oneshot;

/// Streams HTTP responses for model providers from Rust so the webview is not
/// subject to CORS and keys never pass through a browser fetch.
#[derive(Default)]
pub struct AiState {
    cancels: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiEvent {
    Status { status: u16 },
    Chunk { data: String },
}

#[tauri::command]
pub async fn ai_stream(
    state: State<'_, AiState>,
    request_id: String,
    url: String,
    headers: HashMap<String, String>,
    body: String,
    on_event: Channel<AiEvent>,
) -> Result<(), String> {
    let (tx, mut rx) = oneshot::channel();
    state.cancels.lock().unwrap().insert(request_id.clone(), tx);

    let work = async {
        let client = reqwest::Client::new();
        let mut req = client.post(&url).body(body);
        for (k, v) in &headers {
            req = req.header(k, v);
        }
        let resp = req.send().await.map_err(|e| e.to_string())?;
        let _ = on_event.send(AiEvent::Status { status: resp.status().as_u16() });
        let mut stream = resp.bytes_stream();
        let mut carry = Vec::new();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            let data = crate::decode_utf8_carry(&mut carry, &chunk);
            if !data.is_empty() {
                on_event.send(AiEvent::Chunk { data }).map_err(|e| e.to_string())?;
            }
        }
        Ok::<(), String>(())
    };

    let result = tokio::select! {
        r = work => r,
        _ = &mut rx => Err("cancelled".into()),
    };
    state.cancels.lock().unwrap().remove(&request_id);
    result
}

#[tauri::command]
pub fn ai_cancel(state: State<'_, AiState>, request_id: String) {
    if let Some(tx) = state.cancels.lock().unwrap().remove(&request_id) {
        let _ = tx.send(());
    }
}
