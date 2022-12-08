import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ChakraProvider } from "@chakra-ui/provider"
import theme from "./theme/index"

import Remotes from './pages/Remotes'
import Remote from './pages/Remote'

import { window as TWindow } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'

const l = '/' + TWindow.getCurrent().label
// FIXME use router API?
if (window.location.pathname !== l) {
  window.location.pathname = l
}

const App = () => {
    useEffect(() => {
      const listenEvent = async () => {
        const unl = await listen('msgbox_retry', (e: {
          payload: [
            // FIXME Im not sure about this fields names
            status: string, statusMsg: string, connectionMsg: string, idkMsg: string, idkBool: boolean
          ]
        }) => {
          console.log(e)
        })
        return unl
      }

      const unlisten = listenEvent();
      listenEvent()
      return () => {
        unlisten.then(unlFn => unlFn())
      }
    }, [])

    return (
      <BrowserRouter>
        <ChakraProvider theme={theme}>
          <Routes>
            <Route path='/main' element={<Remotes />} />
            <Route path='/remote' element={<Remote />} />
          </Routes>
        </ChakraProvider>
      </BrowserRouter>
    )
  }
  
  export default App
  
