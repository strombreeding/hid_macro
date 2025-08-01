// i-server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Vite 개발 서버
    methods: ["GET", "POST"],
  },
});

const clients = {}; // { m: socket, p: socket, d: socket }
let controllerType = null; // p,d 중 하나. m이 입력하는 키를 어떤 컨트롤러가 받을지
let loreCnt = 1;
let loreInterval = null;
let petFeed = 0;

// 정적 파일 서빙 (빌드된 Vite 앱)
app.use(express.static("frontend/dist"));

// /front 엔드포인트 - 빌드된 Vite 앱 반환
app.get("/hid_macro", (req, res) => {
  console.log("index.html 요청");
  res.sendFile("frontend/dist/index.html", { root: "." });
});

const emitWebData = () => {
  if (clients.w == null) return;
  const webData = {
    loreCnt,
    controllerType,
    client: {
      p: clients.p != null,
      d: clients.d != null,
      m: clients.m != null,
    },
    isLore: loreInterval != null,
  };
  console.log("webData 전송", webData);
  clients.w.emit("webData", JSON.stringify(webData));
};

// 클라이언트 소켓 연결
io.on("connection", (socket) => {
  console.log(`새 연결: ${socket.id}`);

  //- 클라이언트가 본인들 id를 말할거니까 메모리에 저장
  socket.on("register", (id) => {
    clients[id] = socket;
    console.log(`등록됨: ${id} (${socket.id})`);
    clients[id].emit("register", `등록됨: ${id} (${socket.id})`);
  });

  socket.on("keyDown", (data) => {
    // 이건 m에서 올것임.

    // 컨트롤러 변경키는 막음
    if (controllerType === null) return;
    console.log(`수신된 키다운`, data);

    // 컨트롤러 프리스트인 경우 모든 키 이벤트를 p로 보냄
    if (controllerType === "0") {
      if (clients.p == null) return;
      clients.p.emit("keyDown", data);
      return;
    }
    // 컨트롤러 용기사인 경우 모든 키 이벤트를 d로 보냄
    if (controllerType === "9") {
      if (clients.d == null) return;
      clients.d.emit("keyDown", data);
      return;
    }
  });

  socket.on("keyUp", (data) => {
    // 이건 m에서 올것임.

    // 컨트롤러 변경키는 막음
    if (controllerType === null) return;
    console.log(`수신된 키업`, data);
    // 컨트롤러 프리스트인 경우 모든 키 이벤트를 p로 보냄
    if (controllerType === "0") {
      if (clients.p == null) return;
      clients.p.emit("keyUp", data);
      return;
    }
    // 컨트롤러 용기사인 경우 모든 키 이벤트를 d로 보냄
    if (controllerType === "9") {
      if (clients.d == null) return;
      clients.d.emit("keyUp", data);
      return;
    }
  });

  socket.on("toggleLore", (data) => {
    if (data !== "f3") return;
    if (loreInterval == null) {
      console.log("로어 시작");
      loreInterval = true;
      clients.d.emit("lore", "start");
      clients.p.emit("heal", "start");
    } else {
      loreInterval = null;
      console.log("로어 중지");
      clients.d.emit("lore", "stop");
      clients.p.emit("heal", "stop");
    }
    emitWebData();
  });

  socket.on("settingLoreCnt", (data) => {
    if (data !== "f4") return;

    if (loreCnt > 1) {
      loreCnt = 1;
    } else {
      loreCnt = 2;
    }
    emitWebData();
    console.log("로어카운트 : ", loreCnt);
  });

  socket.on("execSymbol", (data) => {
    if (data !== "f5") return;
    // 혹시모르니 로어 끄기
    if (loreInterval != null) {
      console.log("로어 중지");
      clients.d.emit("lore", "stop");
      clients.p.emit("heal", "stop");
      loreInterval = null;
      new Promise((resolve) => setTimeout(resolve, 2500));
    }

    console.log("심볼 사용,드래곤블러드 쓰기");
    clients.d.emit("keyDown", "space");
    new Promise((resolve) => setTimeout(resolve, 1500));
    clients.d.emit("keyUp", "space");

    clients.p.emit("keyDown", "pageup");
    new Promise((resolve) => setTimeout(resolve, 500));
    clients.p.emit("keyUp", "pageup");
    setTimeout(() => {
      clients.p.emit("keyDown", "pagedown");
      new Promise((resolve) => setTimeout(resolve, 1000));
      clients.p.emit("keyUp", "pagedown");
      clients.d.emit("lore", "start");
      clients.p.emit("heal", "start");
      loreInterval = true;
    }, 1200);
    emitWebData();
  });

  //- m이 원격으로 컨트롤러 조종
  // 0=용기사 , 0=프리스트
  socket.on("toggleController", (data) => {
    // m이 아닌 경우 리턴
    if (socket !== clients.m) return;

    // 혹시모르니 로어 끄기
    if (loreInterval != null) {
      console.log("로어 중지");
      clients.d.emit("lore", "stop");
      clients.p.emit("heal", "stop");
      loreInterval = null;
    }

    // 컨트롤러가 정해진게 없을때 p,d 입력받으면 해당 컨트롤러로 전환
    if (controllerType === null && (data === "0" || data === "9")) {
      controllerType = data;
      clients.m.emit("msg", true);
      emitWebData();
      return;
    }

    // 프리스트 컨트롤러 끄기
    if (controllerType === "0" && data === "0") {
      controllerType = null;
      clients.m.emit("msg", false);
      emitWebData();
      return;
    }

    // d 컨트롤러 끄기
    if (controllerType === "9" && data === "9") {
      controllerType = null;
      clients.m.emit("msg", false);
      emitWebData();
      return;
    }

    // p 컨트롤러에서 d로 전환
    if (controllerType === "0" && data === "9") {
      controllerType = "9";
      clients.m.emit("msg", true);
      emitWebData();
      return;
    }

    // d 컨트롤러에서 p로 전환
    if (controllerType === "9" && data === "0") {
      controllerType = "0";
      clients.m.emit("msg", true);
      emitWebData();
      return;
    }
  });

  socket.on("disconnect", () => {
    for (const [id, s] of Object.entries(clients)) {
      if (s.id === socket.id) {
        console.log(`${id} (${socket.id}) 연결 종료됨`);
        delete clients[id];
      }
    }
    emitWebData();
  });
});

server.listen(3000, () => {
  console.log("I 서버 실행 중 (포트 3000)");
  //   startConsole();
});
