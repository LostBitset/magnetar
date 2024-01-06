package main

import (
	"fmt"
	"net/http"
	"os"
)

func SetupServeMux(mux *http.ServeMux) {
	HandleFunc(mux, "/folder", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("TODO"))
	})
	HandleFunc(mux, "/file", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("TODO"))
	})
	HandleStaticFile(mux, "/favicon.ico", "favicon.ico", "image/x-icon")
	HandleStaticRedirect(mux, "/", "/folder?path=%2F")
}

type LoggableResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *LoggableResponseWriter) Write(bytes []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = 200
	}
	return w.ResponseWriter.Write(bytes)
}

func (w *LoggableResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func HandleFunc(
	mux *http.ServeMux, pattern string, h func(w http.ResponseWriter, r *http.Request),
) {
	mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
		wLoggable := LoggableResponseWriter{w, 0}
		h(&wLoggable, r)
		fmt.Printf(
			"[page] (HTTP %d) %s <- %s\n",
			wLoggable.statusCode, pattern, r.URL.String(),
		)
	})
}

func HandleStaticRedirect(mux *http.ServeMux, pattern string, to string) {
	HandleFunc(mux, pattern, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Location", to)
		w.WriteHeader(301)
	})
}

func HandleStaticFile(mux *http.ServeMux, pattern string, path string, mimeType string) {
	HandleFunc(mux, pattern, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", mimeType)
		content, err := os.ReadFile(path)
		if err == nil {
			w.Write(content)
		} else {
			fmt.Fprintln(os.Stderr, err.Error())
			w.WriteHeader(500)
		}
	})
}

func main() {
	port := ":7400"
	fmt.Printf("[init] [1/3] servemux creation ")
	mux := http.NewServeMux()
	fmt.Printf("ok\n[init] [2/3] servemux setup ")
	SetupServeMux(mux)
	fmt.Printf("ok\n[init] [3/3] Listening on port %s...\n", port)
	http.ListenAndServe(port, mux)
}
