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
        include: [{ model: db.user, as: "user", attributes: ["id", "name", "phone"] }],
      },
    ],
  },
  {
    model: Owner,
    as: "owner",
    include: [{ model: db.user, as: "user", attributes: ["id", "name", "phone"] }],
  },
];

const generateBookingCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `BKG-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await Booking.findOne({ where: { bookingCode: code } });

    if (!existing) {
      return code;
    }
  }

  return `BKG-${Date.now().toString().slice(-6)}`;
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
    requiredDate,
    labourRequired = 1,
    note,
  } = payload;

  const requiredCount = Number(labourRequired) || 1;

  if (!skill || !pincode) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: "Skill and PIN code are required",
      },
    };
  }

  if (requiredCount < 1 || requiredCount > 20) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: "You can request between 1 and 20 workers",
      },
    };
  }

  const ownerData = ownerId ? await Owner.findOne({
    where: { id: ownerId },
    include: [{ model: db.user, as: "user", attributes: ["id", "name", "phone"] }],
  }) : null;
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
        message: `${requiredCount} workers requested, but only ${availableCount} are available`,
        requiredCount,
        availableCount,
        data: matchedLabours,
      },
    };
  }

  const booking = await db.sequelize.transaction(async (transaction) => {
    const createdBooking = await Booking.create({
      bookingCode: await generateBookingCode(),
      ownerId: ownerId || null,
      ownerName: ownerName || ownerData?.user?.name || null,
      ownerPhone: ownerPhone || ownerData?.user?.phone || null,
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
      requiredDate: requiredDate || null,
      labourRequired: requiredCount,
      allocatedCount: 0,
      status: "pending",
      note,
    }, { transaction });

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
      message: "Booking submitted and awaiting approval",
      requiredCount,
      allocatedCount: 0,
      data: mapBooking(createdData),
    },
  };
};

const getBookingsService = async ({ ownerId, labourId, status, search, skill, district, pincode, page = 1, limit = 20 }) => {
  const { Op } = db.Sequelize;
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
  if (skill) {
    where.skill = { [Op.iLike]: `%${String(skill).trim()}%` };
  }
  if (district) {
    where.district = { [Op.iLike]: `%${String(district).trim()}%` };
  }
  if (pincode) {
    where.pincode = String(pincode).trim();
  }
  if (search) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { bookingCode: { [Op.iLike]: q } },
      { ownerName: { [Op.iLike]: q } },
      { ownerPhone: { [Op.iLike]: q } },
      { skill: { [Op.iLike]: q } },
      { district: { [Op.iLike]: q } },
      { pincode: { [Op.iLike]: q } },
    ];
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
      data: {
        items: result.rows.map(mapBooking).map((item) => ({
          ...item,
          labourName: item.allocatedLabours?.[0]?.labour?.user?.name || null,
          labourPhone: item.allocatedLabours?.[0]?.labour?.user?.phone || null,
          location: [item.district, item.state].filter(Boolean).join(", "),
          bookingDate: item.requiredDate || item.createdAt,
          assignedLabourCount: item.allocatedCount || item.allocatedLabours?.length || 0,
        })),
        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total: result.count,
          totalPages: Math.ceil(result.count / pageLimit) || 1,
        },
      },
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
  const statusMap = {
    approved: "confirmed",
    assigned: "confirmed",
    in_progress: "confirmed",
    rejected: "cancelled",
  };
  const requestedStatus = String(status || "").toLowerCase();
  const dbStatus = statusMap[requestedStatus] || requestedStatus;
  const allowedStatus = ["pending", "confirmed", "cancelled", "completed"];

  if (!allowedStatus.includes(dbStatus)) {
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

  await booking.update({ status: dbStatus });

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
