package models

type Product struct {
	ID, CategoryID                                      int64
	CategoryName, Name, Description, ImageURL, UnitType string
	BasePrice, StockQuantity                            float64
	SizeOptions                                         any
	IsActive                                            bool
}
type Order struct {
	ID, UserID, TimeSlotID              int64
	OrderNumber                         string
	RiderID                             *int64
	DeliveryAddress                     string
	DeliveryLatitude, DeliveryLongitude float64
	DeliveryDate, PaymentMethod, Status string
	Subtotal, Shipping, Total           float64
	CreatedAt, UpdatedAt                string
	SlotStartTime, SlotEndTime          string
	DeliveryProof                       *DeliveryProof
	Items                               []OrderItem
}
type OrderItem struct {
	ID, ProductID, SizeML, Quantity            int64
	ProductName, ImageURL, UnitType, SizeLabel string
	UnitPrice, ItemTotal                       float64
}
type Rider struct {
	ID, UserID         int64
	Name, Email, Phone string
	PasswordHash       string
	VehicleType        string
	VehicleNumber      string
	IsActive           bool
	IsAvailable        bool
}
type RiderTimeSlot struct {
	ID, RiderID, TimeSlotID int64
	CreatedAt               string
}
type DeliveryProof struct {
	ID, OrderID, RiderID int64
	FileURL              string
	CapturedAt           string
}
