const bookingService = require("./service");

const createBooking = async (req,res) => {
  try {
    const result = await bookingService.createBookingService(req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const getBookings = async (req,res) => {
  try {
    const result = await bookingService.getBookingsService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const getBookingById = async (req,res) => {
  try {
    const result = await bookingService.getBookingByIdService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const updateBookingStatus = async (req,res) => {
  try {
    const result = await bookingService.updateBookingStatusService(req.params.id, req.body);
    if (req.originalUrl?.startsWith("/api/admin/bookings")) {
      return res.status(result.statusCode).send(
        result.statusCode >= 400 ? result.body : { success: true, message: "Booking status updated successfully" }
      );
    }
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const updateAllocationStatus = async (req,res) => {
  try {
    const result = await bookingService.updateAllocationStatusService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  updateAllocationStatus,
};
