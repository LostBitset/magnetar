package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"
)

func PerformUpdate(k string, v string) {
	fmt.Println("TODO")
}

func SetupServeMux(mux *http.ServeMux) {
	HandleStaticFile(mux, "/favicon.ico", "favicon.ico", "image/x-icon")
	HandleStaticFile(mux, "/style.css", "output/style.css", "text/css")
	HandleFunc(mux, "/__update__", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		if !(query.Has("k") && query.Has("v")) {
			w.WriteHeader(400)
		}
		k, v := query.Get("k"), query.Get("v")
		PerformUpdate(k, v)
	})
	HandleFunc(mux, "/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "text/html")
		concept, _ := strings.CutPrefix(r.URL.Path, "/")
		if strings.Contains(concept, "..") {
			w.Write([]byte("<h1>Relative Paths are not allowed.</h1>"))
			return
		}
		content, err := os.ReadFile("output/" + concept + ".html")
		editable := strings.ReplaceAll(
			string(content),
			"data-mtar-ref=", "contenteditable oninput=\"up(this)\" data-mtar-ref=",
		)
		if err == nil {
			w.Write([]byte(editable))
		} else {
			fmt.Fprintln(os.Stderr, err.Error())
			w.WriteHeader(500)
		}
	})
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
