// r-server.js

const { io } = require("socket.io-client");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const HID_PATH = "/dev/hidg0";
const app = express();
const port = 5000;
const socket = io("https://c-link.co.kr"); // ← 실제 I 서버 주소로 수정

// 키 코드 매핑
const KEY_CODES = {
  a: 0x04,
  b: 0x05,
  c: 0x06,
  d: 0x07,
  e: 0x08,
  f: 0x09,
  g: 0x0a,
  h: 0x0b,
  i: 0x0c,
  j: 0x0d,
  k: 0x0e,
  l: 0x0f,
  m: 0x10,
  n: 0x11,
  o: 0x12,
  p: 0x13,
  q: 0x14,
  r: 0x15,
  s: 0x16,
  t: 0x17,
  u: 0x18,
  v: 0x19,
  w: 0x1a,
  x: 0x1b,
  y: 0x1c,
  z: 0x1d,

  1: 0x1e,
  2: 0x1f,
  3: 0x20,
  4: 0x21,
  5: 0x22,
  6: 0x23,
  7: 0x24,
  8: 0x25,
  9: 0x26,
  0: 0x27,

  uparrow: 0x52,
  downarrow: 0x51,
  leftarrow: 0x50,
  rightarrow: 0x4f,

  leftshift: 0x02, // modifier bitmask
  leftctrl: 0x01,
  leftalt: 0x04,

  return: 0x28, // Enter 키
  enter: 0x28, // Enter 키 (별칭)
  space: 0x2c,
};

// HID 입력 함수
async function sendHIDKey(key, down) {
  const code = KEY_CODES[key];

  if (!code) {
    console.log(`알 수 없는 키: ${key}`);
    return;
  }

  let modifier = 0x00;
  let keycode = 0x00;

  // Modifier 키 처리
  if (["lshift", "lctrl", "lalt"].includes(key)) {
    modifier = code;
  } else {
    keycode = code;
  }

  const buf = Buffer.alloc(8);
  buf[0] = modifier;
  buf[2] = keycode;

  try {
    if (down) {
      fs.writeFileSync(HID_PATH, buf); // Key Down
    } else {
      fs.writeFileSync(HID_PATH, Buffer.alloc(8)); // Key Up
    }
  } catch (err) {
    console.error(`❌ HID 전송 실패: ${err.message}`);
  }
}

socket.on("connect", () => {
  console.log("[D] I 서버에 연결됨");
  socket.emit("register", "d");
});

socket.on("msg", (msg) => {
  console.log("[I → D] 수신 메시지:", msg);
});

socket.on("keyDown", async (key) => {
  sendHIDKey(key.replaceAll(" ", ""), true);
  // }
});

socket.on("keyUp", async (key) => {
  sendHIDKey(key.replaceAll(" ", ""), false);
  // }
});
