# LSP HTTP Relay

This process forwards all LSP messages arriving on `stdin` to a specified HTTP endpoint and outputs the response to
`stdout`.

It can be used to provide a LSP entry point via the default stream based interface to communicate with a
Language Server that communicates only via HTTP requests.
