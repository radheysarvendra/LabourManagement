const CATEGORIES = [
  {
    name: "Construction & Building Work",
    hindi: "निर्माण कार्य",
    icon: "🏗️",
    color: "#1565C0",
    skills: [
      { skillName: "Mason", hindi: "राजमिस्त्री", defaultWage: 600 },
      { skillName: "Carpenter", hindi: "बढ़ई", defaultWage: 550 },
      { skillName: "Painter", hindi: "पेंटर", defaultWage: 450 },
      { skillName: "Electrician", hindi: "इलेक्ट्रिशियन", defaultWage: 700 },
      { skillName: "Plumber", hindi: "प्लंबर", defaultWage: 600 },
      { skillName: "Tile Fitting Worker", hindi: "टाइल मिस्त्री", defaultWage: 550 },
      { skillName: "Road Construction", hindi: "सड़क मजदूर", defaultWage: 400 },
      { skillName: "Welding Worker", hindi: "वेल्डर", defaultWage: 650 },
    ],
  },
  {
    name: "Agriculture & Farming",
    hindi: "कृषि कार्य",
    icon: "🌾",
    color: "#2E7D32",
    skills: [
      { skillName: "Farm Labourer", hindi: "खेत मजदूर", defaultWage: 300 },
      { skillName: "Harvesting", hindi: "कटाई मजदूर", defaultWage: 350 },
      { skillName: "Plantation", hindi: "रोपाई मजदूर", defaultWage: 300 },
      { skillName: "Irrigation", hindi: "सिंचाई मजदूर", defaultWage: 300 },
      { skillName: "Dairy Farm", hindi: "डेयरी मजदूर", defaultWage: 350 },
      { skillName: "Poultry Farm", hindi: "मुर्गी फार्म", defaultWage: 300 },
    ],
  },
  {
    name: "Factory & Industrial Work",
    hindi: "कारखाना कार्य",
    icon: "🏭",
    color: "#6A1B9A",
    skills: [
      { skillName: "Packing Worker", hindi: "पैकिंग मजदूर", defaultWage: 350 },
      { skillName: "Machine Operator", hindi: "मशीन ऑपरेटर", defaultWage: 500 },
      { skillName: "Loading/Unloading", hindi: "लोडिंग मजदूर", defaultWage: 400 },
      { skillName: "Warehouse Worker", hindi: "गोदाम मजदूर", defaultWage: 380 },
      { skillName: "Assembly Line Worker", hindi: "असेंबली मजदूर", defaultWage: 400 },
    ],
  },
  {
    name: "Transport & Delivery",
    hindi: "परिवहन कार्य",
    icon: "🚚",
    color: "#E65100",
    skills: [
      { skillName: "Truck Loading Worker", hindi: "ट्रक लोडर", defaultWage: 400 },
      { skillName: "Rickshaw/E-rickshaw", hindi: "रिक्शा चालक", defaultWage: 350 },
      { skillName: "Delivery Boy", hindi: "डिलीवरी बॉय", defaultWage: 400 },
      { skillName: "Courier Helper", hindi: "कुरियर हेल्पर", defaultWage: 350 },
      { skillName: "Porter/Coolie", hindi: "कुली", defaultWage: 300 },
    ],
  },
  {
    name: "Domestic & Household Work",
    hindi: "घरेलू कार्य",
    icon: "🏠",
    color: "#AD1457",
    skills: [
      { skillName: "Housemaid", hindi: "घरेलू सहायिका", defaultWage: 300 },
      { skillName: "Cook/Helper", hindi: "रसोइया", defaultWage: 350 },
      { skillName: "Cleaner", hindi: "सफाई कर्मी", defaultWage: 280 },
      { skillName: "Gardener", hindi: "माली", defaultWage: 300 },
      { skillName: "Caretaker", hindi: "देखभालकर्ता", defaultWage: 350 },
    ],
  },
  {
    name: "Market & Shop Work",
    hindi: "बाजार कार्य",
    icon: "🛒",
    color: "#00695C",
    skills: [
      { skillName: "Shop Helper", hindi: "दुकान सहायक", defaultWage: 300 },
      { skillName: "Vegetable Market Labour", hindi: "सब्जी मंडी मजदूर", defaultWage: 300 },
      { skillName: "Tea Stall Helper", hindi: "चाय दुकान सहायक", defaultWage: 280 },
      { skillName: "Hotel/Dhaba Worker", hindi: "होटल मजदूर", defaultWage: 320 },
      { skillName: "Cash Counter Assistant", hindi: "काउंटर सहायक", defaultWage: 350 },
    ],
  },
  {
    name: "Skilled Daily Wage Work",
    hindi: "कुशल दैनिक कार्य",
    icon: "⚙️",
    color: "#F57F17",
    skills: [
      { skillName: "Tailor", hindi: "दर्जी", defaultWage: 450 },
      { skillName: "Barber", hindi: "नाई", defaultWage: 350 },
      { skillName: "Mechanic", hindi: "मैकेनिक", defaultWage: 500 },
      { skillName: "Mobile Repair", hindi: "मोबाइल मरम्मत", defaultWage: 450 },
      { skillName: "AC/Fridge Repair", hindi: "AC/फ्रिज मरम्मत", defaultWage: 600 },
    ],
  },
  {
    name: "Event & Temporary Work",
    hindi: "इवेंट कार्य",
    icon: "🎪",
    color: "#4527A0",
    skills: [
      { skillName: "Tent House Worker", hindi: "तंबू मजदूर", defaultWage: 400 },
      { skillName: "Decoration Worker", hindi: "सजावट मजदूर", defaultWage: 450 },
      { skillName: "Sound/Light Helper", hindi: "साउंड हेल्पर", defaultWage: 400 },
      { skillName: "Catering Helper", hindi: "केटरिंग सहायक", defaultWage: 350 },
      { skillName: "Videographer", hindi: "वीडियोग्राफर", defaultWage: 800 },
    ],
  },
  {
    name: "Other Common Labour Jobs",
    hindi: "अन्य कार्य",
    icon: "👷",
    color: "#37474F",
    skills: [
      { skillName: "Security Guard", hindi: "सुरक्षा गार्ड", defaultWage: 400 },
      { skillName: "Garbage Collection", hindi: "कचरा सफाई", defaultWage: 280 },
      { skillName: "Brick Kiln Worker", hindi: "ईंट भट्टा मजदूर", defaultWage: 350 },
      { skillName: "Stone Crusher Labour", hindi: "पत्थर क्रशर", defaultWage: 380 },
      { skillName: "Mining Labour", hindi: "खनन मजदूर", defaultWage: 420 },
      { skillName: "Handpump/Boring", hindi: "हैंडपंप/बोरिंग", defaultWage: 500 },
    ],
  },
];

const seedSkills = async (Skill, Category, CategorySkill) => {
  for (const categoryData of CATEGORIES) {
    const [category] = await Category.findOrCreate({
      where: { name: categoryData.name },
      defaults: {
        name: categoryData.name,
        hindi: categoryData.hindi,
        icon: categoryData.icon,
        color: categoryData.color,
        isActive: true,
      },
    });

    await category.update({
      hindi: categoryData.hindi,
      icon: categoryData.icon,
      color: categoryData.color,
      isActive: true,
    });

    for (const skillData of categoryData.skills) {
      const [skill] = await Skill.findOrCreate({
        where: { skillName: skillData.skillName },
        defaults: {
          ...skillData,
          category: "general",
          isActive: true,
        },
      });

      await skill.update({
        hindi: skillData.hindi,
        defaultWage: skillData.defaultWage,
        category: skill.category || "general",
        isActive: true,
      });

      const [categorySkill] = await CategorySkill.findOrCreate({
        where: { categoryId: category.id, skillId: skill.id },
        defaults: { categoryId: category.id, skillId: skill.id, isActive: true },
      });

      if (!categorySkill.isActive) {
        await categorySkill.update({ isActive: true });
      }
    }
  }
};

module.exports = {
  CATEGORIES,
  seedSkills,
};
