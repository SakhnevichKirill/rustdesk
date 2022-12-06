import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'

const Remote = () => {
    const [width, setWidth] = useState(0)

    useEffect(() => {
        const listenEvents = async () => {
            await invoke('reconnect')

            const unlistenSetDisplay = await listen('setDisplay', (e: { payload: [x: number, y: number, w: number, h: number] }) => {
                    setWidth(e.payload[2])
                })
            const unlistenNativeRemote = await listen('native-remote', (e:any) => {
                    console.log(e)
                })

            return {unlistenSetDisplay, unlistenNativeRemote}
        }

        const unlisten = listenEvents().catch(() => null)

        return () => {
           unlisten.then(unl => {
              if (unl) {
                  unl.unlistenNativeRemote()
                  unl.unlistenSetDisplay()
              } 
           }) 
        }
    }, [])
    
    return (
        <div>
            Remote {width}
        </div>
    )
}

export default Remote
