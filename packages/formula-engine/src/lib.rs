use wasm_bindgen::prelude::*;

pub mod parser;
pub mod evaluator;
pub mod engine;

// WASM 패닉 시 콘솔에 에러 출력 (개발 편의)
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
