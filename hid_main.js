// i-server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const exceptionKey = ["p", "d", "l", "x"];
const clients = {}; // { m: socket, p: socket, d: socket }
let controllerType = null; // p,d 중 하나. m이 입력하는 키를 어떤 컨트롤러가 받을지
let loreCnt = 1;
let loreInterval = null;

const emitLore = () => {
  if (clients.d == null) return;
  console.log("로어 키 입력");
  clients.d.emit("keyDown", "leftshift");
  clients.d.emit("keyUp", "leftshift");
};

const emitHeal = () => {
  if (clients.p == null) return;
  clients.p.emit("keyDown", "leftctrl");
  clients.p.emit("keyUp", "leftctrl");
};

const randomHealExec = () => {
  const randomHealTime = Math.random() * 2000 + 4000;
  setTimeout(() => {
    emitHeal();
  }, randomHealTime);
};

const randomLoreExec = () => {
  const randomTime = Math.random() * 1000 + 2500;
  setTimeout(() => {
    emitLore();
  }, randomTime);
};

const startLore = () => {
  loreInterval = setInterval(() => {
    // 로어를 먼저 쓰고
    emitLore();

    // 랜덤하게 힐 쓰기
    randomHealExec();

    // 로어를 2번 써야할 경우 2.5~3.5초 랜덤하게 한번 더 사용
    if (loreCnt > 1) {
      randomLoreExec();
    }
  }, 6500);
};

const stopLore = () => {
  clearInterval(loreInterval);
  loreInterval = null;
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
    if (exceptionKey.includes(data)) return;
    console.log(`수신된 키다운`, data);

    // 컨트롤러 p인 경우 모든 키 이벤트를 p로 보냄
    if (controllerType === "p") {
      if (clients.p == null) return;
      clients.p.emit("keyDown", data);
      return;
    }
    // 컨트롤러 d인 경우 모든 키 이벤트를 d로 보냄
    if (controllerType === "d") {
      if (clients.d == null) return;
      clients.d.emit("keyDown", data);
      return;
    }
  });

  socket.on("keyUp", (data) => {
    // 이건 m에서 올것임.

    // 컨트롤러 변경키는 막음
    if (exceptionKey.includes(data)) return;
    console.log(`수신된 키업`, data);

    // 컨트롤러 p인 경우 모든 키 이벤트를 p로 보냄
    if (controllerType === "p") {
      if (clients.p == null) return;
      clients.p.emit("keyUp", data);
      return;
    }
    // 컨트롤러 d인 경우 모든 키 이벤트를 d로 보냄
    if (controllerType === "d") {
      if (clients.d == null) return;
      clients.d.emit("keyUp", data);
      return;
    }
  });

  socket.on("toggleLore", (data) => {
    if (data !== "x") return;
    if (loreInterval == null) {
      console.log("로어 시작");
      startLore();
    } else {
      console.log("로어 중지");
      stopLore();
    }
  });

  socket.on("settingLoreCnt", (data) => {
    if (data !== "l") return;

    if (loreCnt > 1) {
      loreCnt = 1;
    } else {
      loreCnt = 2;
    }
    console.log("로어카운트 : ", loreCnt);
  });

  //- m이 원격으로 컨트롤러 조종
  socket.on("toggleController", (data) => {
    // m이 아닌 경우 리턴
    if (socket !== clients.m) return;
    // 컨트롤러가 정해진게 없을때 p,d 입력받으면 해당 컨트롤러로 전환
    if (controllerType === null && (data === "p" || data === "d")) {
      controllerType = data;
      clients.m.emit("msg", true);
      return;
    }

    // p 컨트롤러 끄기
    if (controllerType === "p" && data === "p") {
      controllerType = null;
      clients.m.emit("msg", false);
      return;
    }

    // d 컨트롤러 끄기
    if (controllerType === "d" && data === "d") {
      controllerType = null;
      clients.m.emit("msg", false);
      return;
    }

    // p 컨트롤러에서 d로 전환
    if (controllerType === "p" && data === "d") {
      controllerType = "d";
      clients.m.emit("msg", true);
      return;
    }

    // d 컨트롤러에서 p로 전환
    if (controllerType === "d" && data === "p") {
      controllerType = "p";
      clients.m.emit("msg", true);
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
  });
});

server.listen(3000, () => {
  console.log("I 서버 실행 중 (포트 3000)");
  //   startConsole();
});
