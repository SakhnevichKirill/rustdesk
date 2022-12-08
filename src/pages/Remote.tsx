import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'

const Remote = () => {
    const [remoteDim, setRemoteDim] = useState({ width: 0, height: 0 })
    const [pixels, setPixels] = useState<Uint8ClampedArray>(new Uint8ClampedArray([0]))

    useEffect(() => {
        const listenEvents = async () => {
            await invoke('reconnect')

            const unlistenSetDisplay = await listen('setDisplay', (e: { payload: [x: number, y: number, w: number, h: number] }) => {
                    setRemoteDim({ width: e.payload[2], height: e.payload[3] })
                })
            const unlistenNativeRemote = await listen('native-remote', (e: { payload: Uint8ClampedArray }) => {
                    setPixels(new Uint8ClampedArray(e.payload))
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

    useEffect(() => {
        const { width, height} = remoteDim
        if (width && height && pixels.length > 1) {
            const imageData = new ImageData(pixels, width)
            const canvas = document.getElementById('canvas') as HTMLCanvasElement
            const ctx = canvas?.getContext('2d');
            if (ctx) {
                ctx.putImageData(imageData, 0, 0)
            }
        }
    }, [remoteDim, pixels])
    
    return (
        <div>
            <canvas id="canvas" {...remoteDim}></canvas>
        </div>
    )
}

export default Remote
