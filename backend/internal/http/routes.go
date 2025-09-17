package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
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

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "https://stack-guard-task.vercel.app",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "*",
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Routes
	app.Get("/ping", pingHandler)
	app.Post("/scan", scanHandler)
	app.Post("/scan/bulk", scanBulkHandler)
	app.Get("/tickets", listTicketsHandler)
	app.Post("/resolve/:id", resolveHandler)
	app.Post("/ignore/:id", ignoreHandler)
	app.Post("/tickets/bulk", ticketsBulkHandler)

	return app
}
