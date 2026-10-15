from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class GameHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ('/', '/index.html'):
            self.send_response(302)
            self.send_header('Location', '/roost-and-ruin.html')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return
        super().do_GET()

ThreadingHTTPServer(('0.0.0.0', 8000), GameHandler).serve_forever()
