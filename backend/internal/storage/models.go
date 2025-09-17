package storage

import "time"

type Issue struct {
	ID          string    `gorm:"primaryKey;type:uuid" json:"id"`
	Type        string    `json:"type"`
	Status      string    `json:"status"`
	Repo        string    `json:"repo"`
	Commit      string    `json:"commit"`
	Channel     string    `json:"channel"`
	File        string    `json:"file"`
	Content     string    `gorm:"type:text" json:"content"`
	Fingerprint string    `gorm:"index;size:64" json:"-"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Suppression struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Fingerprint string     `gorm:"index;size:64" json:"fingerprint"`
	Reason      string     `gorm:"type:text" json:"reason"`
	ExpiresAt   *time.Time `json:"expiresAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

func Migrate() error {
	return DB.AutoMigrate(&Issue{}, &Suppression{})
}
