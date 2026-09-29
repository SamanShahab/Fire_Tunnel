import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveVpn, setLiveVpn] = useState([]);

  useEffect(() => {
    const s = io("/");
    setSocket(s);

    s.on("newEvent", (event) => setLiveEvents((prev) => [event, ...prev].slice(0, 50)));
    s.on("newSecurityEvent", (event) => setLiveEvents((prev) => [event, ...prev].slice(0, 50)));
    s.on("vpnConnect", (session) => setLiveVpn((prev) => [session, ...prev].slice(0, 20)));
    s.on("vpnDisconnect", (session) =>
      setLiveVpn((prev) => prev.map((v) => (v._id === session._id ? session : v)))
    );

    return () => s.disconnect();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, liveEvents, liveVpn }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
