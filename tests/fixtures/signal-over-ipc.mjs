// Test-only preload: Windows can't deliver SIGTERM to a Node process (it terminates it
// outright), so tests send the signal's name over IPC and this emits it inside the server.
process.on('message', (signal) => process.emit(signal, signal));
