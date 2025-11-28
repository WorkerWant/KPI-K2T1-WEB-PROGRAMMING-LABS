package main

import (
	"bufio"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Event struct {
	Seq        int    `json:"seq"`
	Type       string `json:"type"`
	Message    string `json:"message"`
	ClientTime string `json:"clientTime"`
	User       string `json:"user"`
	ServerTime string `json:"serverTime,omitempty"`
}

type BulkPayload struct {
	Events  []Event `json:"events"`
	SavedAt string  `json:"savedAt"`
}

type ListResponse struct {
	Stream []Event      `json:"stream"`
	Bulk   BulkPayload  `json:"bulk"`
}

type TimeResponse struct {
	ServerTime string `json:"serverTime"`
}

const maxFileBytes int64 = 8 * 1024 * 1024

func dataFile(name string) (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	root := filepath.Dir(dir)
	return filepath.Join(root, "data", name), nil
}

func userSubdir(user string) string {
	if user == "" {
		return "default"
	}
	var b strings.Builder
	for _, r := range user {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return "default"
	}
	return b.String()
}

func ensureDir(path string) error {
	dir := filepath.Dir(path)
	return os.MkdirAll(dir, 0755)
}

func trimFile(path string, maxBytes int64) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return
	}
	if int64(len(raw)) <= maxBytes {
		return
	}
	trimmed := raw[int64(len(raw))-maxBytes:]
	os.WriteFile(path, trimmed, 0644)
}

func handleStream(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var ev Event
	if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	user := userSubdir(ev.User)
	if user == "default" {
		user = userSubdir(r.URL.Query().Get("user"))
	}
	ev.ServerTime = time.Now().UTC().Format(time.RFC3339Nano)
	path, err := dataFile(filepath.Join(user, "stream.jsonl"))
	if err != nil {
		http.Error(w, "path error", http.StatusInternalServerError)
		return
	}
	if err := ensureDir(path); err != nil {
		http.Error(w, "dir error", http.StatusInternalServerError)
		return
	}
	line, _ := json.Marshal(ev)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		http.Error(w, "write error", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	f.Write(append(line, '\n'))
	trimFile(path, maxFileBytes)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "serverTime": ev.ServerTime})
}

func handleBulk(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload BulkPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if len(payload.Events) == 0 {
		http.Error(w, "no events", http.StatusBadRequest)
		return
	}
	user := "default"
	if len(payload.Events) > 0 {
		user = userSubdir(payload.Events[0].User)
	}
	if user == "default" {
		user = userSubdir(r.URL.Query().Get("user"))
	}
	path, err := dataFile(filepath.Join(user, "bulk.json"))
	if err != nil {
		http.Error(w, "path error", http.StatusInternalServerError)
		return
	}
	if err := ensureDir(path); err != nil {
		http.Error(w, "dir error", http.StatusInternalServerError)
		return
	}
	var existing BulkPayload
	if raw, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(raw, &existing)
	}
	payload.SavedAt = time.Now().UTC().Format(time.RFC3339Nano)
	merged := BulkPayload{
		Events:  append(existing.Events, payload.Events...),
		SavedAt: payload.SavedAt,
	}
	data, _ := json.MarshalIndent(merged, "", "  ")
	if int64(len(data)) > maxFileBytes {
		http.Error(w, "storage limit reached", http.StatusBadRequest)
		return
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		http.Error(w, "write error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "savedAt": payload.SavedAt})
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	user := userSubdir(r.URL.Query().Get("user"))
	paths := []string{filepath.Join(user, "stream.jsonl"), filepath.Join(user, "bulk.json")}
	for _, name := range paths {
		if p, err := dataFile(name); err == nil {
			os.Remove(p)
		}
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var resp ListResponse
	user := userSubdir(r.URL.Query().Get("user"))
	streamPath, err := dataFile(filepath.Join(user, "stream.jsonl"))
	if err == nil {
		if f, err := os.Open(streamPath); err == nil {
			defer f.Close()
			sc := bufio.NewScanner(f)
			for sc.Scan() {
				var ev Event
				if err := json.Unmarshal(sc.Bytes(), &ev); err == nil {
					resp.Stream = append(resp.Stream, ev)
				}
			}
		}
	}
	bulkPath, err := dataFile(filepath.Join(user, "bulk.json"))
	if err == nil {
		if raw, err := os.ReadFile(bulkPath); err == nil {
			json.Unmarshal(raw, &resp.Bulk)
		}
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(resp)
}

func handleTime(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	resp := TimeResponse{ServerTime: time.Now().UTC().Format(time.RFC3339Nano)}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(resp)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/stream", handleStream)
	mux.HandleFunc("/bulk", handleBulk)
	mux.HandleFunc("/list", handleList)
	mux.HandleFunc("/reset", handleReset)
	mux.HandleFunc("/time", handleTime)
	handler := cors(mux)
	server := &http.Server{
		Addr:              ":8091",
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Println("lab7 api :8091")
	log.Fatal(server.ListenAndServe())
}
