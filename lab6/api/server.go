package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Item struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type Payload struct {
	Items   []Item `json:"items"`
	Updated string `json:"updated"`
}

func dataPath() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	root := filepath.Dir(dir)
	return filepath.Join(root, "data", "accordion.json"), nil
}

func load() Payload {
	path, err := dataPath()
	if err != nil {
		return defaultPayload()
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return defaultPayload()
	}
	var p Payload
	if err := json.Unmarshal(raw, &p); err != nil {
		return defaultPayload()
	}
	return p
}

func save(p Payload) error {
	path, err := dataPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func defaultPayload() Payload {
	return Payload{
		Items: []Item{
			{Title: "Strategy", Content: "Текст першого елемента"},
			{Title: "Concept", Content: "Текст другого елемента"},
		},
	}
}

func clean(items []Item) []Item {
	out := make([]Item, 0, len(items))
	for _, it := range items {
		title := strings.TrimSpace(it.Title)
		content := strings.TrimSpace(it.Content)
		if title == "" && content == "" {
			continue
		}
		out = append(out, Item{Title: title, Content: content})
	}
	return out
}

func handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	switch r.Method {
	case http.MethodGet:
		p := load()
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(p)
	case http.MethodPost:
		var p Payload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		p.Items = clean(p.Items)
		p.Updated = time.Now().Format(time.RFC3339)
		if err := save(p); err != nil {
			http.Error(w, "failed to save", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "updated": p.Updated})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func main() {
	http.HandleFunc("/accordion", handler)
	log.Println("listen on :8090")
	log.Fatal(http.ListenAndServe(":8090", nil))
}
