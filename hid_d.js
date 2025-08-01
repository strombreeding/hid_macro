const { io } = require("socket.io-client");
const { SerialPort } = require("serialport");
const { list } = require("@serialport/list");

// 소켓 서버 주소
const SOCKET_SERVER = "https://c-link.co.kr";

// USB Gadget 설정에 맞춘 vendorId, productId (예시)
const VENDOR_ID = "046d"; // Logitech (예시)
const PRODUCT_ID = "c31c"; // Multifunction Composite Gadget

async function findPiPort() {
  const ports = await list();

  for (const port of ports) {
    // vendorId, productId는 소문자로 비교
    if (
      port.vendorId?.toLowerCase() === VENDOR_ID &&
      port.productId?.toLowerCase() === PRODUCT_ID
    ) {
      console.log("라즈베리파이 시리얼 포트 발견:", port.path);
      return port.path;
    }
  }

  throw new Error("라즈베리파이 시리얼 포트를 찾을 수 없습니다.");
}

async function main() {
  try {
    const serialPath = await findPiPort();

    const port = new SerialPort({
      path: serialPath,
      baudRate: 115200,
    });

    port.on("open", () => {
      console.log("시리얼 포트 열림:", serialPath);
    });

    port.on("error", (err) => {
      console.error("시리얼 포트 에러:", err.message);
    });

    // 소켓 연결
    const socket = io(SOCKET_SERVER);

    socket.on("connect", () => {
      console.log("[D] I 서버에 연결됨");
      socket.emit("register", "d");
    });

    socket.on("msg", (msg) => {
      console.log("[I → D] 수신 메시지:", msg);
    });

    socket.on("keyDown", (key) => {
      const msg = `keyDown ${key}\n`;
      console.log("[Socket] keyDown -> 시리얼 전송:", msg.trim());
      port.write(msg);
    });

    socket.on("keyUp", (key) => {
      const msg = `keyUp ${key}\n`;
      console.log("[Socket] keyUp -> 시리얼 전송:", msg.trim());
      port.write(msg);
    });

    socket.on("disconnect", () => {
      console.log("소켓 서버 연결 끊김");
    });
  } catch (err) {
    console.error("에러 발생:", err.message);
  }
}

main();
