const https = require("https");

const INDIA_POST_PINCODE_URL = "https://api.postalpincode.in/pincode";

const isValidPincode = (pincode) => /^\d{6}$/.test(String(pincode || "").trim());

const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, { rejectUnauthorized: false }, (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error("India Post response parse nahi ho paya"));
          }
        });
      })
      .on("error", reject);
  });

const getPincodeDetails = async (pincode) => {
  const normalizedPincode = String(pincode || "").trim();

  if (!isValidPincode(normalizedPincode)) {
    const error = new Error("Valid 6 digit pincode required hai");
    error.statusCode = 400;
    throw error;
  }

  const response = await fetchJson(`${INDIA_POST_PINCODE_URL}/${normalizedPincode}`);
  const result = Array.isArray(response) ? response[0] : null;
  const postOffices = result?.PostOffice || [];

  if (result?.Status !== "Success" || postOffices.length === 0) {
    const error = new Error("Pincode India Post par valid nahi mila");
    error.statusCode = 400;
    throw error;
  }

  const primaryOffice = postOffices[0];
  const mappedPostOffice = postOffices.map((office) => ({
    name: office.Name || "",
    branchType: office.BranchType || "",
    deliveryStatus: office.DeliveryStatus || "",
    circle: office.Circle || "",
    district: office.District || "",
    division: office.Division || "",
    region: office.Region || "",
    block: office.Block || "",
    state: office.State || "",
    country: office.Country || "",
    pincode: office.Pincode || normalizedPincode,
  }));

  return {
    pincode: normalizedPincode,
    area: primaryOffice.Name || "",
    areaNames: mappedPostOffice.map((office) => office.name).filter(Boolean),
    district: primaryOffice.District || "",
    state: primaryOffice.State || "",
    postOffice: mappedPostOffice,
  };
};

module.exports = {
  getPincodeDetails,
  isValidPincode,
};
