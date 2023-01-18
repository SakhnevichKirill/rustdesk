import { Button, Center, Heading, Input, Stack } from "@chakra-ui/react"
import { invoke } from "@tauri-apps/api"
import { listen } from "@tauri-apps/api/event"
import { useEffect, useState } from "react"
import { WebviewWindow } from '@tauri-apps/api/window'

class Connection {
    id: number 
    is_file_transfer: boolean
    port_forward: string
    peer_id: string 
    name: string
    authorized: boolean
    time: Date
    now: Date
    keyboard: boolean 
    clipboard: boolean 
    msgs: Array<any>
    unreaded: number
    audio: boolean 
    file: boolean 
    restart: boolean 
    recording: boolean
    disconnected: boolean

    constructor(id: number, is_file_transfer: boolean, port_forward: string, peer_id: string, name: string, authorized: boolean, keyboard: boolean, clipboard: boolean, audio: boolean, file: boolean, restart: boolean, recording: boolean) {
        this.id = id
        this.is_file_transfer = is_file_transfer
        this.peer_id = peer_id
        this.port_forward = port_forward
        this.name = name
        this.authorized = authorized 
        this.time = new Date()
        this.now = new Date()
        this.keyboard = keyboard 
        this.clipboard = clipboard 
        this.msgs = []
        this.unreaded = 0
        this.audio = audio 
        this.file = file
        this.restart = restart 
        this.recording = recording
        this.disconnected = false
    }
}


function getTime(): number {
    let now = new Date()
    return now.valueOf()
}

function getNowStr(): string {
    let now = new Date()
    return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
}


const ConnectionManager = () => {    
    const [showElevation, setShowElevation] = useState(true)
    const [showElevationBtn, setShowElevationBtn] = useState(false)
    const [showAcceptBtn, setShowAcceptBtn] = useState(false)
    const [connId, setConnId] = useState<number>(0)
    const [curIdx, setCurIdx] = useState<number>(-1)
    const [connection, setConnection] = useState<Connection>()
    const [connections, setConnections] = useState<Array<Connection>>([])
    const [window, setWindow] = useState<WebviewWindow | null>(WebviewWindow.getByLabel('cm'))

    const bring_to_top = (idx=-1) => {
        if (window) {
            window.isVisible().then((visible) => {
                if (visible) {
                    window.setFocus()
                }
                else {
                    window.show()
                    window.setFocus()
                    if (idx >= 0) {
                        setCurIdx(idx)
                    }
                }
            })
        }
        else {
            console.log("ConnectionManager: window not found")
        }
        
    }

    const sendMsg = (text: string) => {
        if (!text) return;

        checkClickTime(() => {
            if (connection){
                let conn = connection
                conn.msgs.push({ name: "me", text: text, time: getNowStr()});
                setConnection(conn)
                invoke("send_msg", {id: conn.id, text: text}).then(console.log)
                // body.update();
            }
        });
    }

    const checkClickTime = (callback: any) => {
        if (connection){
            let click_callback_time = getTime();
            invoke('check_click_time', { id: connection.id }).then(console.log)
            setTimeout(async () => {
                let d = click_callback_time - await invoke<number>("get_click_time");
                if (d > 120)
                    callback();
            }, 120);
        }   
    }

    
    
    useEffect(() => {
        const listenEvents = async () => {
            const unlistenShowElevation = await listen('showElevation', (e: {
                payload: [
                    show: boolean
                ]
            }) => {
                let show = e.payload[0] 
                if (show !== showElevation) {
                    setShowElevation(show)
                    // update();
                }
            })

            const unlistenAddConnection = await listen('addConnection', (e: {
                payload: Array<any>
                }) => {
                    let id = e.payload[0]
                    let is_file_transfer = e.payload[1]
                    let port_forward = e.payload[2]
                    let peer_id = e.payload[3]
                    let name = e.payload[4]
                    let authorized = e.payload[5]
                    let keyboard = e.payload[6]
                    let clipboard = e.payload[7]
                    let audio = e.payload[8]
                    let file = e.payload[9]
                    let restart = e.payload[10]
                    let recording = e.payload[11]

                    console.log("new connection #" + id + ": " + peer_id)
                    let conn: Connection | undefined
                    const nextConnections = connections.map((c) => {
                        if (c.id === id) {
                            c.authorized = authorized
                            conn = c
                        }
                        return c
                    })
                    if (conn) {
                        setConnections(nextConnections)
                        // update();
                        return;
                    }
                    let idx = -1;
                    connections.map((c, i) => {
                        if (c.disconnected && c.peer_id === peer_id) idx = i;
                        return c
                    });
                    if (!name) name = "NA";
                    
                    let newConn = new Connection(id, is_file_transfer, peer_id, port_forward, name, 
                        authorized, keyboard, clipboard, audio, file, restart, recording)
                    if (idx < 0) {
                        let connArray = [...connections, newConn]
                        setConnections(connArray)
                        setCurIdx(connArray.length - 1)
                    } else {
                        connections[idx] = newConn;
                        setCurIdx(idx)
                    }
                    bring_to_top();
                    // update();
                    // self.timer(1ms, adjustHeader);
                    if (authorized) {
                        setTimeout(() => {
                            window?.minimize()
                            // view.windowState = View.WINDOW_MINIMIZED;
                        }, 3000);
                    }

                })
            return {unlistenAddConnection, unlistenShowElevation}
        }

        const unlisten = listenEvents().catch(() => null)

        return () => {
           unlisten.then(unl => {
              if (unl) {
                  unl.unlistenAddConnection()
                  unl.unlistenShowElevation()
              } 
           }) 
        }
    }, [])

    const elevate = async () => {
        checkClickTime(async () => {
            setShowElevation(false)
            // body.update()
            await invoke("elevate_portable", {id: connId});
            setTimeout(() => {
                window?.minimize()
            }, 30);
        });
    }
    
    const accept = () => {
        checkClickTime(function() {
            if (connection) {
                // body.update();
                let conn = connection
                conn.authorized = true
                setConnection(conn)
                invoke("authorize", {id: connId}).then()
                setTimeout(() => {
                    window?.minimize()
                }, 30);
            }

        });
    }

    const dismiss = () => {
        checkClickTime(function() {
            invoke("close", {id: connId}).then()
        })
    }

    const disconnect = () => {
        checkClickTime(function() {
            invoke("close", {id: connId}).then()
        });
    }

    const close = () =>{
        let currrent = curIdx
        if (currrent >= 0 && currrent < connections.length){
            invoke("remove_disconnected_connection", {id: connId}).then()
            connections.splice(currrent, 1)
            if (connections.length > 0) {
                if (currrent > 0){
                    currrent -= 1
                } else {
                    currrent = connections.length - 1
                }
                setCurIdx(currrent)
                // header.update();
                // body.update();
            } else {
                invoke("quit").then()
            }
        }
        
    }

    const iconKeyboard = () => {
        checkClickTime(function() {
            let conn = connection
            if (conn) {
                conn.keyboard = !conn.keyboard;
                setConnection(conn)
                // body.update();
                invoke('switch_permission', {id: connId, name: "keyboard", enabled: conn.keyboard});
            }
            
        });
    }

    const iconClipboard = () => {
        checkClickTime(function() {
            let conn = connection
            if (conn) {
                conn.clipboard = !conn.clipboard;
                setConnection(conn)
                // body.update();
                invoke('switch_permission', {id: connId, name: "clipboard", enabled: conn.clipboard});
            }
        });
    }

    const iconAudio = () => {
        checkClickTime(function() {
            let conn = connection
            if (conn) {
                conn.audio = !conn.audio;
                setConnection(conn)
                // body.update();
                invoke('switch_permission', {id: connId, name: "audio", enabled: conn.audio});
            }
        })
    }
    
    const iconFile = () => {
        checkClickTime(function() {
            let conn = connection
            if (conn) {
                conn.file = !conn.file;
                setConnection(conn)
                // body.update();
                invoke('switch_permission', {id: connId, name: "file", enabled: conn.file});
            }
        })
    }

    const iconRestart = () => {
        checkClickTime(function() {
            let conn = connection
            if (conn) {
                conn.restart = !conn.restart;
                setConnection(conn)
                // body.update();
                invoke('switch_permission', {id: connId, name: "restart", enabled: conn.restart});
            }
        })
    }

    const iconRecording = () => {
        checkClickTime(function() {
            let conn = connection
            if (conn) {
                conn.recording = !conn.recording;
                setConnection(conn)
                // body.update();
                invoke('switch_permission', {id: connId, name: "recording", enabled: conn.recording});
            }
        })
    }

    // Body class
    const Manager = () => {
        if (connection) {
            console.log("Manager", connection.is_file_transfer || connection.port_forward || connection.disconnected ? "not show" : "show")
            return (
                <div>
                    New connection!
                    {connection.is_file_transfer || connection.port_forward || connection.disconnected ? "" : <div>Permissions</div>}
                    {/* TODO: ? : <div> </div> - doesn't render */}
                    {connection.is_file_transfer || connection.port_forward || connection.disconnected ? "" : <div> 
                        <div className={!connection.keyboard ? "disabled" : ""} title={'Allow using keyboard and mouse'}><Button onClick={() => iconKeyboard()} /></div>
                        <div className={!connection.clipboard ? "disabled" : ""} title={'Allow using clipboard'}><Button onClick={() => iconClipboard()} /></div>
                        <div className={!connection.audio ? "disabled" : ""} title={'Allow hearing sound'}><Button onClick={() => iconAudio()} /></div>
                        <div className={!connection.file ? "disabled" : ""} title={'Allow file copy and paste'}><Button onClick={() => iconFile()} /></div>
                        <div className={!connection.restart ? "disabled" : ""} title={'Allow remote restart'}><Button onClick={() => iconRestart()} /></div>
                        <div className={!connection.recording ? "disabled" : ""} title={'Allow recording session'}><Button onClick={() => iconRecording()} /></div>
                    </div>
                    }
                    {!connection.authorized && !connection.disconnected && showElevationBtn && showAcceptBtn ? <Button onClick={() => elevate()}>Elevate</Button> : "" }
                    <div>
                        {!connection.authorized && showAcceptBtn ? <Button onClick={() => accept()}>Accept</Button> : "" }
                        {!connection.authorized ? <Button onClick={() => dismiss()}>Dismiss</Button> : "" }
                    </div>
                    {connection.authorized && !connection.disconnected ? <Button onClick={() => disconnect()}>Disconnect</Button> : "" }
                    {connection.authorized && connection.disconnected ? <Button onClick={() => close()}>Close</Button> : "" }
                </div>
            )
        }
        else {
            return (
                <div>
                    Waiting for new connection ...
                </div>
            )
        }
    }

    // Body render
    useEffect(() => {
        if (connections.length === 0) {
            return
        }
        setConnection(connections[curIdx])
        console.log("Manager: " + curIdx + connection)

        if (connection) {
            setConnId(connection.id)

            // TODO: implement ChatBox class
            let callback = function(msg: string) {
                sendMsg(msg)
            }
            invoke<boolean>("can_elevate").then((canElevate: boolean)=>{
                console.log("ShowElevationBtn: ", canElevate && showElevation && !connection.is_file_transfer && connection.port_forward.length === 0)
                setShowElevationBtn(canElevate && showElevation && !connection.is_file_transfer && connection.port_forward.length === 0)
            }) 
            invoke<string>("get_option", {key: 'approve-mode'}).then((approve_mode: string) => {
                console.log("ShowAcceptBtn: ", approve_mode !== 'password')
                setShowAcceptBtn(approve_mode !== 'password')
            })            
        }
    })

    return (
        <Center h='100vh'>
            <Stack spacing='12px'>
                <Heading>Connection manager</Heading>
                <div>
                    <Manager/>
                </div>
            </Stack>
        </Center>
    )
}

export default ConnectionManager

