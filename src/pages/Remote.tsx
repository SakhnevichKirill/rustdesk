import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Box, Center, CircularProgress, Text } from '@chakra-ui/react'

import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'
import { appWindow } from '@tauri-apps/api/window'

class EncodedFrame {
    data: Uint8Array //Uint8ClampedArray 
    key: boolean
    pts: number
    constructor(
        data: Uint8Array,
        key: boolean,
        pts: number,
    ) {
        this.data = data
        this.key = key
        this.pts = pts
    }
}


const Remote = () => {
    const [connectionLoading, setConnecitonLoading] = useState(true)
    const [msg, setMsg] = useState("")
    const [connectionSpeed, setConnectionSpeed] = useState("")

    const [remoteDim, setRemoteDim] = useState({ width: 0, height: 0 })
    const [pixels, setPixels] = useState<Uint8ClampedArray>(new Uint8ClampedArray([0]))
    const [reconnectTimeout, setReconnectTimeout] = useState(1000) 
    // const [initMuxer, setInitMuxer] = useState<boolean>(false)

    const [initBuffer, setInitBuffer] = useState<boolean>(false)

    useEffect(() => {
        const listenEvents = async () => {
            setConnecitonLoading(true)

            // TODO: emit on "video#handler" init
            appWindow.emit('native-remote')

            const unlistenNativeRemoteResponse = await listen('native-remote-response', (e: { payload: any }) => {
                retryConnect()
            })

            const connecting = () => {
                // TODO: implement msgbox
                // handler.msgbox("connecting", "Connecting...", "Connection in progress. Please wait.")
            }

            const retryConnect = (cancelTimer: boolean = false) => {
                invoke<boolean>("is_port_forward").then((is_port_forward) => {
                    if (cancelTimer) setTimeout(retryConnect, 0)
                    if (!is_port_forward) connecting()
                    invoke("reconnect").then()
                    console.log("reconnect")
                })
            }

            const unlistenMsgboxRetry = await listen('msgbox_retry', (e: {
                payload: [
                    type: string, title: string, text: string, link: string, hasRetry: boolean
                ]
            }) => {
                const type = e.payload[0]
                // const title = e.payload[1]
                // const text = e.payload[2]
                // const link = e.payload[3]
                const hasRetry = e.payload[4]
                
                
                if (type) {
                    setConnecitonLoading(false)
                    setMsg("")
                }
                if (type === 'input-password') setMsg('Подтвердите подключение')

                // TODO: implement msgbox
                // handler.msgbox(type, title, text, link, hasRetry)
                if (hasRetry) {
                    setTimeout(retryConnect, 0)
                    setTimeout(retryConnect, reconnectTimeout)
                    setReconnectTimeout(reconnectTimeout * 2)
                } else {
                    setReconnectTimeout(1000)
                }
            })
            const unlistenSetDisplay = await listen('setDisplay', (e: { payload: [x: number, y: number, w: number, h: number] }) => {
                setRemoteDim({ width: e.payload[2], height: e.payload[3] })
            })
            const unlistenRenderFrame = await listen('render_frame', (e: { payload: Uint8ClampedArray }) => {
                setPixels(new Uint8ClampedArray(e.payload))
            })
            const unlistenUpdateQualityStatus = await listen('updateQualityStatus', (e: {payload: string[]}) => {
                setConnectionSpeed(e.payload[0])
            })

            return {unlistenNativeRemoteResponse, unlistenMsgboxRetry, unlistenSetDisplay, unlistenRenderFrame, unlistenUpdateQualityStatus}
        }

        const unlisten = listenEvents().catch(() => null)

        return () => {
           unlisten.then(unl => {
              if (unl) {
                unl.unlistenNativeRemoteResponse()
                unl.unlistenMsgboxRetry()
                unl.unlistenSetDisplay()
                unl.unlistenRenderFrame()
                unl.unlistenUpdateQualityStatus()
              } 
           }) 
        }
    }, [])

    let frames = [];
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const mediaSource = useMemo(() => new MediaSource(), [])
    let mediaSrcBuffer: SourceBuffer | null = null

    useEffect(() => {
        const video = videoRef.current
        if ('MediaSource' in window && video) {
            video.src = URL.createObjectURL(mediaSource)
            mediaSource.addEventListener('sourceopen', handleSourceOpen)
            mediaSource.addEventListener('sourceended', function(e) { 
                console.log('sourceended: ' + mediaSource.readyState);
                // Nothing else to load
                mediaSource.endOfStream();
                // Start playback!
                // Note: this will fail if video is not muted, due to rules about
                // autoplay and non-muted videos
                video.play();
            });
            mediaSource.addEventListener('sourceclose', function(e) { console.log('sourceclose: ' + mediaSource.readyState); });
            mediaSource.addEventListener('error', function(e) { console.log('error: ' + mediaSource.readyState); });
            return () => {
                mediaSource.removeEventListener('sourceopen', handleSourceOpen)
            };
        } else{
            console.log(video)
            console.error('Doesnt support MediaSource')
        }
    }, [mediaSource])

    const handleSourceOpen = () => {
       mediaSrcBuffer = mediaSource.addSourceBuffer('video/webm;codecs="vp9,vorbis"')
       console.log('sourceopen: ' + mediaSource.readyState);
    }

    useEffect(() => {
        const listenEvents = async () => {
            const unlistenEncodedFrames = await listen('encoded_frame', (e: { payload: EncodedFrame }) => {
                let frame = e.payload
                if (mediaSrcBuffer) {
                    if (mediaSrcBuffer.updating) {
                        frames.push(frame);
                    } else {
                        // TODO: data: Uint8Array //Uint8ClampedArray 
                        // key: boolean
                        // pts: number

                        
                        if (frame.key) {
                            console.log("write_video: key={}", frame.key)
                            setInitBuffer(frame.key)
                        }
                        let pts = frame.pts * 1_000_000
                        console.log("pts", pts)
                        mediaSrcBuffer.appendBuffer(frame.data); 

                        // TODO: we need call "appendBuffer" only if initBuffer==True (begin of vp9 stram), but "initBuffer" not changing on "setInitBuffer" call
                        // if (initBuffer) {
                        //     console.log(initBuffer)
                        //     mediaSrcBuffer.appendBuffer(frame.data); 
                        // }
                        
                        // TODO: If you want new frame.key=True without "reconnect", then call "refresh_video"
                        // invoke("refresh_video").then(
                        //         () => {
                        //             console.log("refresh_video")
                        //             // invoke("record_screen").then()
                        //         }
                        //     )


                        // TODO: end of vp9 stream stream when ever you want
                        
                    }
                }
                
                // e.payload.map((frame: EncodedFrame) => {
                    
                    
                // })

                
                // console.log(e)
                // // TODO могут данные прийти, а буфера нет открылось?
                // if (mediaSrcBuffer) {
                //     const binArr = new Uint8Array(e.payload.data)
                //     mediaSrcBuffer.appendBuffer(binArr.buffer)
                // }

                // tmp_muxer.addVideoChunkRaw(
                //     e.payload.data,
                //     e.payload.key == true ? 'key' : 'delta',
                //     e.payload.pts,
                //     {decoderConfig: {codec: 'vp9' }}
                // )

                
                // setPixels(new Uint8ClampedArray(e.payload))
            })
            return {unlistenEncodedFrames}
        }

        const unlisten = listenEvents().catch(() => null)

        return () => {
           unlisten.then(unl => {
              if (unl) {
                unl.unlistenEncodedFrames()
              } 
           }) 
        }
    }, [initBuffer])

    useEffect(() => {
        console.log("remoteDim", remoteDim)
        // TODO:
        // Create a muxer with a video track running the VP9 codec, and no
        // audio track. The muxed file is written to a buffer in memory.

        // const { width, height} = remoteDim
        // if (width && height && pixels.length > 1) {
        //     const imageData = new ImageData(pixels, width, height, {
        //         colorSpace: "srgb" 
        //     })
        //     const canvas = document.getElementById('canvas') as HTMLCanvasElement
        //     const ctx = canvas?.getContext('2d')
        //     if (ctx) {
        //         ctx.putImageData(imageData, 0, 0)
        //     }
        // }
    }, [remoteDim, pixels])
    
    return (
        <Center h="100vh">
            <Text pos='absolute' left={0} top={0} color='red'>{connectionSpeed}</Text>
            <Box height='100%'>
                {connectionLoading ?
                    <>"Подключаемся... "<CircularProgress isIndeterminate/></> :
                    <canvas id="canvas" width={1690} height={1122}></canvas>
                }
                <Text>{msg}</Text>
            </Box>
            <video ref={videoRef}/>
        </Center>
    )
}

export default Remote
