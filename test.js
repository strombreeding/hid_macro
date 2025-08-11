const express = require("express");
const { SerialPort } = require("serialport");
const fs = require("fs");
const path = require("path");
const app = express();

let port;

const POSSIBLE_PATTERNS = [
  "usbmodem",
  "usbserial",
  "wchusbserial", // CH340/CP210x 계열
  "ttyAMA", // 일부 라즈베리파이 시리얼
];

async function findPiPort() {
  const deviceDir = "/dev";
  const entries = fs.readdirSync(deviceDir);

  const candidates = entries
    .filter((name) =>
      POSSIBLE_PATTERNS.some((pattern) => name.includes(pattern))
    )
    .map((name) => path.join(deviceDir, name));

  if (candidates.length === 0) {
    throw new Error("라즈베리파이로 보이는 시리얼 포트를 찾을 수 없습니다.");
  }

  // 여기선 일단 첫 번째 후보 사용하지만, 나중에 더 정교한 필터링 가능
  return candidates[0];
}

app.use(express.json());

let execing = false;
let execing2 = "stay";
app.get("/xy", (req, res) => {
  const { x, y } = req.query;
  console.log("xy", x, y, execing);
  // 1번
  if (execing && x < 1395) {
    port.write("keyUp leftarrow\n");
    port.write("keyUp rightarrow\n");
    execing = false;
    return res.send("ok");
  }
  if (!execing && x > 1395) {
    port.write("keyUp rightarrow\n");
    port.write("keyDown leftarrow\n");
    execing = true;
    return res.send("ok");
  }

  console.log("2번", execing2);

  // 2번
  if (execing2 === "start" && (x > 1335 || x < 1350)) {
    port.write("keyUp rightarrow\n");
    port.write("keyUp leftarrow\n");
    execing2 = false;
  }
  if (execing2 === "ready" && x < 1330) {
    port.write("keyDown rightarrow\n");
    execing2 = "start";
  }
  if (execing2 === "ready" && x > 1355) {
    port.write("keyDown leftarrow\n");
    port.write("keyUp leftarrow\n");
    execing2 = true;
  }

  res.send("ok");
});

app.get("/notfound", (req, res) => {
  console.log("notfound.");
  // setTimeout(() => {
  //   plaing = false;
  // }, 22000);
  res.send("ok");
});
app.get("/detect", (req, res) => {
  console.log("detect.");
  // setTimeout(() => {
  //   plaing = false;
  // }, 22000);
  res.send("ok");
});

app.listen(8083, () => {
  console.log("서버 실행 중");
});

async function main() {
  try {
    const serialPath = await findPiPort();

    port = new SerialPort({
      path: serialPath,
      baudRate: 115200,
    });

    port.on("open", () => {
      console.log("시리얼 포트 열림:", serialPath);
    });

    port.on("error", (err) => {
      console.error("시리얼 포트 에러:", err.message);
    });
  } catch (err) {
    console.error("에러 발생:", err.message);
  }
}

main();
