package http

import (
	"github.com/gofiber/fiber/v2"
)

func SetupRoutes() *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	app.Use(func(c *fiber.Ctx) error {
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Set("Access-Control-Allow-Headers", "*")

		if c.Method() == "OPTIONS" {
			return c.SendStatus(204)
		}

		return c.Next()
	})

	// Routes
	app.Get("/ping", pingHandler)
	app.Post("/scan", scanHandler)
	app.Post("/scan/file", scanFileHandler)
	app.Get("/tickets", listTicketsHandler)
	app.Post("/resolve/:id", resolveHandler)

	return app
}
