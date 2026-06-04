const db = require("../../model/index.js");
const labourService = require("../Labours/service");

const Booking = db.booking;
const BookingAllocation = db.bookingAllocation;
const Labour = db.labour;
const Owner = db.owner;

const bookingInclude = [
  {
    model: BookingAllocation,
    as: "allocations",
    include: [
      {
        model: Labour,
        as: "labour",
      },
    ],
  },
  {
    model: Owner,
    as: "owner",
  },
];

const generateBookingCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await Booking.findOne({ where: { bookingCode: code } });

    if (!existing) {
      return code;
    }
  }

  return `ORD-${Date.now().toString().slice(-6)}`;
};

const getLabourWageForSkill = (labour, skillName) => {
  const skillWages = Array.isArray(labour.skillWages) ? labour.skillWages : [];
  const matchedSkill = skillWages.find(
    (item) => String(item.skill || "").toLowerCase() === String(skillName || "").toLowerCase()
  );

  return Number(matchedSkill?.dailyWage ?? matchedSkill?.wage ?? 0) || null;
};

const mapBooking = (booking) => {
  const json = booking.toJSON ? booking.toJSON() : booking;
  const allocations = Array.isArray(json.allocations) ? json.allocations : [];

  return {
    ...json,
    allocatedLabours: allocations.map((item) => ({
      allocationId: item.id,
      status: item.status,
      dailyWage: item.dailyWage,
      confirmedAt: item.confirmedAt,
      labour: item.labour,
    })),
  };
};

const createBookingService = async (payload) => {
  const {
    ownerId,
    ownerName,
    ownerPhone,
    categoryName,
    skill,
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
    state,
    district,
    pincode,
    postOffice,
    labourRequired = 1,
    note,
  } = payload;

  const requiredCount = Number(labourRequired) || 1;

  if (!skill || !pincode) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: "Skill aur pincode required hai",
      },
    };
  }

  if (requiredCount < 1 || requiredCount > 20) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: "Ek booking me 1 se 20 labour tak request kar sakte hain",
      },
    };
  }

  const ownerData = ownerId ? await Owner.findOne({ where: { id: ownerId } }) : null;
  const searchResult = await labourService.searchLaboursService({
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
    pincode,
    district,
    skill,
    page: 1,
    limit: requiredCount,
  });
  const matchedLabours = searchResult.body?.data || [];
  const availableCount = searchResult.body?.counts?.skillCount ?? matchedLabours.length;

  if (availableCount < requiredCount || matchedLabours.length < requiredCount) {
    return {
      statusCode: 409,
      body: {
        success: false,
        message: `Aapko ${requiredCount} labour chahiye, lekin abhi ${availableCount} hi available hain`,
        requiredCount,
        availableCount,
        data: matchedLabours,
      },
    };
  }

  const allocatedLabours = matchedLabours.slice(0, requiredCount);

  const booking = await db.sequelize.transaction(async (transaction) => {
    const createdBooking = await Booking.create({
      bookingCode: await generateBookingCode(),
      ownerId: ownerId || null,
      ownerName: ownerName || ownerData?.name || null,
      ownerPhone: ownerPhone || ownerData?.phone || null,
      categoryName,
      skill,
      stateId: stateId || null,
      districtId: districtId || null,
      pincodeId: pincodeId || null,
      postOfficeId: postOfficeId || null,
      state: state || searchResult.body?.meta?.state || null,
      district: district || searchResult.body?.meta?.district || null,
      pincode,
      postOffice: postOffice || searchResult.body?.meta?.postOfficeName || null,
      labourRequired: requiredCount,
      allocatedCount: allocatedLabours.length,
      status: "confirmed",
      note,
    }, { transaction });

    for (const labour of allocatedLabours) {
      await BookingAllocation.create({
        bookingId: createdBooking.id,
        labourId: labour.id,
        skill,
        dailyWage: getLabourWageForSkill(labour, skill),
        status: "allocated",
        confirmedAt: new Date(),
      }, { transaction });
    }

    return createdBooking;
  });

  const createdData = await Booking.findOne({
    where: { id: booking.id },
    include: bookingInclude,
  });

  return {
    statusCode: 201,
    body: {
      success: true,
      message: "Booking confirmed successfully",
      data: mapBooking(createdData),
    },
  };
};

const getBookingsService = async ({ ownerId, labourId, status, page = 1, limit = 20 }) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;
  const where = {};
  const include = [...bookingInclude];

  if (ownerId) {
    where.ownerId = ownerId;
  }

  if (status) {
    where.status = status;
  }

  if (labourId) {
    include[0] = {
      ...include[0],
      required: true,
      where: { labourId },
    };
  }

  const result = await Booking.findAndCountAll({
    where,
    include,
    distinct: true,
    order: [["createdAt", "DESC"]],
    offset,
    limit: pageLimit,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      total: result.count,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(result.count / pageLimit),
      data: result.rows.map(mapBooking),
    },
  };
};

const getBookingByIdService = async (id) => {
  const data = await Booking.findOne({ where: { id }, include: bookingInclude });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: "Booking not found" },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, data: mapBooking(data) },
  };
};

const updateBookingStatusService = async (id, { status }) => {
  const allowedStatus = ["pending", "confirmed", "cancelled", "completed"];

  if (!allowedStatus.includes(status)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid booking status" },
    };
  }

  const booking = await Booking.findOne({ where: { id } });

  if (!booking) {
    return {
      statusCode: 404,
      body: { success: false, message: "Booking not found" },
    };
  }

  await booking.update({ status });

  return getBookingByIdService(id);
};

const updateAllocationStatusService = async (id, { status }) => {
  const allowedStatus = ["allocated", "accepted", "rejected", "completed"];

  if (!allowedStatus.includes(status)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid allocation status" },
    };
  }

  const allocation = await BookingAllocation.findOne({ where: { id } });

  if (!allocation) {
    return {
      statusCode: 404,
      body: { success: false, message: "Allocation not found" },
    };
  }

  await allocation.update({
    status,
    confirmedAt: ["accepted", "completed"].includes(status) ? new Date() : allocation.confirmedAt,
  });

  return getBookingByIdService(allocation.bookingId);
};

module.exports = {
  createBookingService,
  getBookingsService,
  getBookingByIdService,
  updateBookingStatusService,
  updateAllocationStatusService,
};
