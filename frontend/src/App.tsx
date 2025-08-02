import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

interface WebData {
  loreCnt: number;
  controllerType: string | null;
  client: {
    p: boolean;
    d: boolean;
    m: boolean;
  };
  isLore: boolean;
}

// 메인 앱 컴포넌트
const App: React.FC = () => {
  const [data, setData] = useState<WebData | null>(null);
  const [socketState, setSocketState] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 소켓 연결 설정
    const socket = io("https://c-link.co.kr"); // hid_main.js 서버 포트

    // 연결 성공 시
    socket.on("connect", () => {
      console.log("서버에 연결되었습니다:", socket.id);
      setSocketState(socket);
    });

    socket.emit("register", "w");

    // 연결 해제 시
    socket.on("disconnect", () => {
      console.log("서버 연결이 해제되었습니다");
    });

    // webData 이벤트 리스너
    socket.on("webData", (webData) => {
      const data = JSON.parse(webData);
      console.log("webData 이벤트 수신:", data);
      setData((prev) => {
        if (prev == null) return data;

        return {
          ...prev,
          ...data,
        };
      });
    });

    // 컴포넌트 언마운트 시 소켓 연결 해제
    return () => {
      socket.disconnect();
    };
  }, []);

  // if (data === null) return <div>Loading...</div>;

  return (
    <div>
      <h1>HID Macro App</h1>
      <p>소켓 연결 상태를 확인하려면 브라우저 콘솔을 확인하세요</p>

      <h2>로어 카운트 : {data?.loreCnt}</h2>
      <h2>
        컨트롤러 타입 :{" "}
        {data?.controllerType === "0"
          ? "프리스트"
          : data?.controllerType === "9"
          ? "용기사"
          : "표도"}
      </h2>
      <h2>로어 상태 : {data?.isLore ? "O" : "X"}</h2>

      <h4>프리스트 컨트롤러 : {data?.client.p ? "연결" : "미연결"}</h4>
      <h4>용기사 컨트롤러 : {data?.client.d ? "연결" : "미연결"}</h4>
      <h4>마스터 컨트롤러 : {data?.client.m ? "연결" : "미연결"}</h4>

      {socketState && (
        <button
          onClick={() => {
            socketState.emit("execSymbol", "f5");
            if (timerRef.current) {
              clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
              audioRef.current?.play();
            }, 5000);
          }}
        >
          버프받기!
        </button>
      )}
      {socketState && (
        <button
          onClick={() => {
            socketState.emit("toggleLore", "f3");
          }}
        >
          로어 시작/종료
        </button>
      )}

      <audio ref={audioRef} src="./alaram.mp3" preload="auto" />
    </div>
  );
};

export default App;
