const https = require("https");

const DISTRICT_DATA_URL =
  "https://raw.githubusercontent.com/aharnish-infotech/india-state-district-json/main/India-State-District.json";

const STATES = [
  ["Andhra Pradesh", "AP"], ["Arunachal Pradesh", "AR"], ["Assam", "AS"], ["Bihar", "BR"],
  ["Chhattisgarh", "CG"], ["Goa", "GA"], ["Gujarat", "GJ"], ["Haryana", "HR"],
  ["Himachal Pradesh", "HP"], ["Jharkhand", "JH"], ["Karnataka", "KA"], ["Kerala", "KL"],
  ["Madhya Pradesh", "MP"], ["Maharashtra", "MH"], ["Manipur", "MN"], ["Meghalaya", "ML"],
  ["Mizoram", "MZ"], ["Nagaland", "NL"], ["Odisha", "OR"], ["Punjab", "PB"],
  ["Rajasthan", "RJ"], ["Sikkim", "SK"], ["Tamil Nadu", "TN"], ["Telangana", "TG"],
  ["Tripura", "TR"], ["Uttar Pradesh", "UP"], ["Uttarakhand", "UK"], ["West Bengal", "WB"],
  ["Delhi", "DL"], ["Jammu & Kashmir", "JK"], ["Ladakh", "LA"], ["Chandigarh", "CH"],
  ["Puducherry", "PY"], ["Andaman & Nicobar", "AN"], ["Lakshadweep", "LD"],
  ["Dadra and Nagar Haveli and Daman and Diu", "DN"],
];

const DISTRICTS = {
  "Uttar Pradesh": ["Lucknow", "Agra", "Kanpur Nagar", "Prayagraj", "Varanasi", "Gorakhpur", "Meerut", "Ghaziabad", "Rae Bareli"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad"],
  Delhi: ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "South Delhi", "West Delhi"],
};

const DISTRICT_OVERRIDES = {
  "Uttar Pradesh": [
    "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya",
    "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki",
    "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli",
    "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad",
    "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur",
    "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj",
    "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar",
    "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau",
    "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh",
    "Prayagraj", "Rae Bareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar",
    "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra",
    "Sultanpur", "Unnao", "Varanasi",
  ],
  Bihar: [
    "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur",
    "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad",
    "Kaimur (Bhabua)", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura",
    "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia",
    "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi",
    "Siwan", "Supaul", "Vaishali", "West Champaran",
  ],
};

const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    const request = https
      .get(url, { rejectUnauthorized: false }, (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);

    request.setTimeout(8000, () => {
      request.destroy(new Error("District data request timed out"));
    });
  });

const normalizeStateName = (stateName) =>
  String(stateName || "")
    .replace(/\(UT\)|\(NCT\)/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

const STATE_NAME_ALIASES = {
  "Andaman and Nicobar Island": "Andaman & Nicobar",
  "Andaman And Nicobar Islands": "Andaman & Nicobar",
  "Jammu and Kashmir": "Jammu & Kashmir",
  "Jammu And Kashmir": "Jammu & Kashmir",
  "Dadra and Nagar Haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "Dadra And Nagar Haveli And Daman And Diu": "Dadra and Nagar Haveli and Daman and Diu",
  "The Dadra And Nagar Haveli And Daman And Diu": "Dadra and Nagar Haveli and Daman and Diu",
  "Daman and Diu": "Dadra and Nagar Haveli and Daman and Diu",
  "Daman And Diu": "Dadra and Nagar Haveli and Daman and Diu",
};

const getRemoteDistricts = async () => {
  try {
    const data = await fetchJson(DISTRICT_DATA_URL);
    const remoteDistricts = {};
    const sourceRows = Array.isArray(data) ? data : data.states || [];

    for (const item of sourceRows) {
      const rawStateName = normalizeStateName(item.state || item.StateName);
      const stateName = STATE_NAME_ALIASES[rawStateName] || rawStateName;
      const districts = (item.districts || [item["DistrictName(InEnglish)"]])
        .map((districtName) =>
          String(districtName || "")
            .replace(/&amp;/gi, "&")
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter(Boolean);

      remoteDistricts[stateName] = [
        ...new Set([...(remoteDistricts[stateName] || []), ...districts]),
      ].sort((a, b) => a.localeCompare(b));
    }

    return remoteDistricts;
  } catch (error) {
    return DISTRICTS;
  }
};

const codeForDistrict = (districtName) =>
  String(districtName || "")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);

const seedAddressData = async (db) => {
  const districtMap = await getRemoteDistricts();

  for (const [stateName, stateCode] of STATES) {
    const districtNames = DISTRICT_OVERRIDES[stateName] || districtMap[stateName] || DISTRICTS[stateName] || [];
    const [state] = await db.state.findOrCreate({
      where: { stateName },
      defaults: { stateName, stateCode, totalDistricts: districtNames.length },
    });

    if (state.totalDistricts !== districtNames.length) {
      await state.update({ totalDistricts: districtNames.length });
    }

    for (const districtName of districtNames) {
      await db.district.findOrCreate({
        where: { stateId: state.id, districtName },
        defaults: { stateId: state.id, districtName, districtCode: codeForDistrict(districtName) },
      });
    }
  }
};

module.exports = {
  STATES,
  DISTRICTS,
  DISTRICT_OVERRIDES,
  seedAddressData,
};
