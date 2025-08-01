const fs = require("fs");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const HID_PATH = "/dev/hidg0";
const SERIAL_PATH = "/dev/ttyGS0"; // 라즈베리파이의 USB 시리얼 장치 경로 (환경에 맞게 조정)

const pressedKeies = [];

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

  return: 0x28,
  enter: 0x28,
  space: 0x2c,
  escape: 0x29,
  backspace: 0x2a,

  uparrow: 0x52,
  downarrow: 0x51,
  leftarrow: 0x50,
  rightarrow: 0x4f,

  leftctrl: 0x01,
  leftshift: 0x02,
  leftalt: 0x04,

  home: 0x4a,
  end: 0x4d,
  insert: 0x49,
  ins: 0x49,
  delete: 0x4c,
  del: 0x4c,
  pageup: 0x4b,
  pagedown: 0x4e,
  f11: 0x44,
  f12: 0x45,
};

const isModifier = (key) =>
  key === "leftctrl" || key === "leftshift" || key === "leftalt";

function sendHIDReport() {
  const buf = Buffer.alloc(8);
  let modifiers = 0x00;
  const keys = [];

  for (const key of pressedKeies) {
    const code = KEY_CODES[key];
    if (!code) continue;

    if (isModifier(key)) {
      modifiers |= code;
    } else {
      if (keys.length < 6) keys.push(code);
    }
  }

  buf[0] = modifiers;
  keys.forEach((code, index) => {
    buf[2 + index] = code;
  });

  try {
    fs.writeFileSync(HID_PATH, buf);
  } catch (err) {
    console.error(`❌ HID 전송 실패: ${err.message}`);
  }
}

// 시리얼 포트 열기
const port = new SerialPort({
  path: SERIAL_PATH,
  baudRate: 115200,
});

// 시리얼 데이터 라인 단위 파서
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

parser.on("data", (line) => {
  const msg = line.trim();
  // 예: keyDown a
  const [command, key] = msg.split(" ");
  if (!command || !key) return;

  if (command === "keyDown") {
    if (!pressedKeies.includes(key)) {
      pressedKeies.push(key);
      console.log("[PI] 키 다운:", key);
      sendHIDReport();
    }
  } else if (command === "keyUp") {
    const idx = pressedKeies.indexOf(key);
    if (idx !== -1) {
      pressedKeies.splice(idx, 1);
      console.log("[PI] 키 업:", key);
      sendHIDReport();
    }
  }
});

port.on("open", () => {
  console.log(`✅ 시리얼 포트 ${SERIAL_PATH} 열림`);
});

port.on("error", (err) => {
  console.error("❌ 시리얼 포트 에러:", err.message);
});

// port.on("data", (data) => {
//   console.log("[D] 시리얼 데이터:", data);
// });
