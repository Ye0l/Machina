import { Component } from 'solid-js'
import { render } from 'solid-js/web'
import App from './App'
import { registerWebEncoder } from './store/embeddings/encoder'

// if (location.hostname === 'dev.agnai.chat') {
//   window.addEventListener('unload', function () {
//     debugger
//   })

//   window.addEventListener('beforeunload', function () {
//     debugger
//   })
// }

// `common/tokenize` has no built-in tokenizer: register one before anything renders.
registerWebEncoder()

const AppContainer: Component = () => <App />

render(() => <AppContainer />, document.getElementById('root') as HTMLElement)
