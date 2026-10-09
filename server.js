require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5000;

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

let supabase = null;
let useDatabase = false;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  useDatabase = true;
  console.log("Supabase connected.");
} else {
  console.log("No Supabase credentials. Running with in-memory storage.");
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Backend is running live!" });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "public/uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const SERVICE_IMAGES = {
  cleaning: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
  "ac-mechanic": "https://images.unsplash.com/photo-1603366591683-a5abc153411f?auto=format&fit=crop&w=1200&q=80",
  "vehicle-mechanic": "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=80",
  plumber: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80",
  electrician: "https://images.unsplash.com/photo-1548962727-4b25973b73f2?auto=format&fit=crop&w=1200&q=80",
};

const defaultServices = [
  { id: uuidv4(), title: "Home Cleaning", category: "cleaning", description: "Professional home cleaning services for a spotless living space.", price: 49, icon: "fas fa-broom", image: SERVICE_IMAGES.cleaning },
  { id: uuidv4(), title: "AC Mechanic", category: "ac-mechanic", description: "Expert AC repair, installation, and maintenance services.", price: 79, icon: "fas fa-snowflake", image: SERVICE_IMAGES["ac-mechanic"] },
  { id: uuidv4(), title: "Vehicle Mechanic", category: "vehicle-mechanic", description: "Skilled mechanics for all types of vehicle repairs and servicing.", price: 99, icon: "fas fa-car", image: SERVICE_IMAGES["vehicle-mechanic"] },
  { id: uuidv4(), title: "Plumber", category: "plumber", description: "Reliable plumbing solutions for leaks, installations, and repairs.", price: 69, icon: "fas fa-faucet", image: SERVICE_IMAGES.plumber },
  { id: uuidv4(), title: "Electrician", category: "electrician", description: "Certified electricians for wiring, fixtures, and electrical repairs.", price: 89, icon: "fas fa-bolt", image: SERVICE_IMAGES.electrician },
];

const defaultWorkers = [
  { id: uuidv4(), service_id: defaultServices[1].id, name: "Rajesh Kumar", phone: "+91 98765 43210", experience: 8, rating: 4.7, photo_url: "", id_card_url: "", skill: "HVAC Repair", skill_level: "expert", hourly_rate: 500, status: "active" },
  { id: uuidv4(), service_id: defaultServices[1].id, name: "Amit Singh", phone: "+91 87654 32109", experience: 5, rating: 4.3, photo_url: "", id_card_url: "", skill: "HVAC Repair", skill_level: "intermediate", hourly_rate: 350, status: "active" },
  { id: uuidv4(), service_id: defaultServices[0].id, name: "Priya Sharma", phone: "+91 76543 21098", experience: 3, rating: 4.8, photo_url: "", id_card_url: "", skill: "Home Cleaning", skill_level: "beginner", hourly_rate: 200, status: "active" },
  { id: uuidv4(), service_id: defaultServices[2].id, name: "Vikram Patel", phone: "+91 65432 10987", experience: 12, rating: 4.9, photo_url: "", id_card_url: "", skill: "Auto Repair", skill_level: "expert", hourly_rate: 500, status: "active" },
  { id: uuidv4(), service_id: defaultServices[3].id, name: "Suresh Reddy", phone: "+91 54321 09876", experience: 7, rating: 4.5, photo_url: "", id_card_url: "", skill: "Pipe Fitting", skill_level: "intermediate", hourly_rate: 350, status: "active" },
  { id: uuidv4(), service_id: defaultServices[4].id, name: "Anil Mehta", phone: "+91 43210 98765", experience: 10, rating: 4.6, photo_url: "", id_card_url: "", skill: "Wiring & Fixtures", skill_level: "expert", hourly_rate: 500, status: "active" },
  { id: uuidv4(), service_id: defaultServices[4].id, name: "Deepak Joshi", phone: "+91 32109 87654", experience: 4, rating: 4.2, photo_url: "", id_card_url: "", skill: "Wiring & Fixtures", skill_level: "intermediate", hourly_rate: 350, status: "active" },
  { id: uuidv4(), service_id: defaultServices[3].id, name: "Manoj Gupta", phone: "+91 21098 76543", experience: 6, rating: 4.4, photo_url: "", id_card_url: "", skill: "Pipe Fitting", skill_level: "intermediate", hourly_rate: 350, status: "active" },
];

let memoryServices = [...defaultServices];
let memoryWorkers = [...defaultWorkers];
let memoryReviews = [];
let memoryBookings = [];

const defaultBookings = [
  { id: uuidv4(), service_id: defaultServices[0].id, user_name: "Rahul Verma", user_phone: "+91 99887 76655", booking_date: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0], booking_time: "10:00 AM", status: "pending", amount: 49, notes: "2BHK deep cleaning" },
  { id: uuidv4(), service_id: defaultServices[1].id, user_name: "Neha Gupta", user_phone: "+91 88776 65544", booking_date: new Date(Date.now() + 86400000).toISOString().split("T")[0], booking_time: "02:00 PM", status: "assigned", amount: 79, notes: "AC not cooling properly" },
  { id: uuidv4(), service_id: defaultServices[3].id, user_name: "Arun Nair", user_phone: "+91 77665 54433", booking_date: new Date().toISOString().split("T")[0], booking_time: "11:00 AM", status: "completed", amount: 69, notes: "Kitchen sink leak" },
  { id: uuidv4(), service_id: defaultServices[4].id, user_name: "Sanjay Rao", user_phone: "+91 66554 43322", booking_date: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0], booking_time: "09:00 AM", status: "pending", amount: 89, notes: "Full house rewiring" },
  { id: uuidv4(), service_id: defaultServices[2].id, user_name: "Pooja Das", user_phone: "+91 55443 32211", booking_date: new Date(Date.now() + 86400000).toISOString().split("T")[0], booking_time: "04:00 PM", status: "cancelled", amount: 99, notes: "Car brake issue" },
  { id: uuidv4(), service_id: defaultServices[0].id, user_name: "Vikash Singh", user_phone: "+91 44332 21100", booking_date: new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0], booking_time: "08:00 AM", status: "pending", amount: 49, notes: "Office cleaning" },
  { id: uuidv4(), service_id: defaultServices[1].id, user_name: "Meera Joshi", user_phone: "+91 33221 10099", booking_date: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0], booking_time: "03:00 PM", status: "completed", amount: 79, notes: "AC installation" },
  { id: uuidv4(), service_id: defaultServices[3].id, user_name: "Karan Malhotra", user_phone: "+91 22110 09988", booking_date: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0], booking_time: "01:00 PM", status: "assigned", amount: 69, notes: "Bathroom renovation piping" },
];
memoryBookings = [...defaultBookings];
defaultBookings.forEach((b, i) => {
  if (!b.created_at) b.created_at = new Date(Date.now() - (i + 1) * 3600 * 1000 * 4).toISOString();
});

async function getServices() {
  if (useDatabase) {
    const { data, error } = await supabase.from("services").select("*");
    if (error) throw error;
    return data;
  }
  return memoryServices;
}

async function getServiceById(id) {
  if (useDatabase) {
    const { data, error } = await supabase.from("services").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }
  return memoryServices.find((s) => s.id === id);
}

async function getServiceByCategory(category) {
  if (useDatabase) {
    const { data, error } = await supabase.from("services").select("*").eq("category", category).single();
    if (error) throw error;
    return data;
  }
  return memoryServices.find((s) => s.category === category);
}

async function createService(service) {
  if (useDatabase) {
    const { data, error } = await supabase.from("services").insert([service]).select().single();
    if (error) throw error;
    return data;
  }
  memoryServices.push(service);
  return service;
}

async function updateService(id, updates) {
  if (useDatabase) {
    const { data, error } = await supabase.from("services").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  const idx = memoryServices.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  memoryServices[idx] = { ...memoryServices[idx], ...updates };
  return memoryServices[idx];
}

async function deleteService(id) {
  if (useDatabase) {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
  memoryServices = memoryServices.filter((s) => s.id !== id);
  memoryWorkers = memoryWorkers.filter((w) => w.service_id !== id);
  return true;
}

async function getWorkers(serviceId) {
  if (useDatabase) {
    let query = supabase.from("workers").select("*");
    if (serviceId) query = query.eq("service_id", serviceId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  if (serviceId) return memoryWorkers.filter((w) => w.service_id === serviceId);
  return memoryWorkers;
}

async function getWorkerById(id) {
  if (useDatabase) {
    const { data, error } = await supabase.from("workers").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }
  return memoryWorkers.find((w) => w.id === id);
}

async function createWorker(worker) {
  if (useDatabase) {
    try {
      const { data, error } = await supabase.from("workers").insert([worker]).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      // Live table may predate the new worker columns — retry with the columns the table actually has.
      if (!isMissingTable(err)) throw err;
    }
    const filtered = await filterWorkerPayload(worker, false);
    const { data, error } = await supabase.from("workers").insert([filtered]).select().single();
    if (error) throw error;
    return data;
  }
  memoryWorkers.push(worker);
  return worker;
}

async function updateWorker(id, updates) {
  if (useDatabase) {
    try {
      const { data, error } = await supabase.from("workers").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      if (!isMissingTable(err)) throw err;
    }
    const filtered = await filterWorkerPayload(updates, true);
    const { data, error } = await supabase.from("workers").update(filtered).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  const idx = memoryWorkers.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  memoryWorkers[idx] = { ...memoryWorkers[idx], ...updates };
  return memoryWorkers[idx];
}

async function deleteWorker(id) {
  if (useDatabase) {
    const { error } = await supabase.from("workers").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
  memoryWorkers = memoryWorkers.filter((w) => w.id !== id);
  memoryReviews = memoryReviews.filter((r) => r.worker_id !== id);
  return true;
}

async function getReviews(workerId) {
  if (useDatabase) {
    const { data, error } = await supabase.from("reviews").select("*").eq("worker_id", workerId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
  return memoryReviews.filter((r) => r.worker_id === workerId);
}

async function createReview(review) {
  if (useDatabase) {
    const { data, error } = await supabase.from("reviews").insert([review]).select().single();
    if (error) throw error;
    return data;
  }
  memoryReviews.push(review);
  const workerReviews = memoryReviews.filter((r) => r.worker_id === review.worker_id);
  const avgRating = workerReviews.reduce((sum, r) => sum + r.rating, 0) / workerReviews.length;
  const wIdx = memoryWorkers.findIndex((w) => w.id === review.worker_id);
  if (wIdx !== -1) memoryWorkers[wIdx].rating = Math.round(avgRating * 10) / 10;
  return review;
}

function isMissingTable(err) {
  const msg = String((err && (err.message || err.details)) || "");
  return /could not find the |does not exist/i.test(msg);
}

const CORE_WORKER_COLUMNS = ["id", "service_id", "name", "phone", "experience", "rating", "photo_url", "id_card_url"];
let knownWorkerColumnsCache = null;

async function knownWorkerColumns() {
  if (knownWorkerColumnsCache) return knownWorkerColumnsCache;
  const { data } = await supabase.from("workers").select("*").limit(1);
  const keys = data && Array.isArray(data) && data.length ? Object.keys(data[0]) : [];
  knownWorkerColumnsCache = keys.length ? keys : CORE_WORKER_COLUMNS;
  return knownWorkerColumnsCache;
}

async function filterWorkerPayload(worker, excludeId) {
  const known = await knownWorkerColumns();
  const out = {};
  for (const k of Object.keys(worker)) {
    if (k === "id" && excludeId) continue;
    if (known.includes(k)) out[k] = worker[k];
  }
  return out;
}

const CORE_BOOKING_COLUMNS = ["id", "service_id", "worker_id", "user_name", "user_phone", "customer_email", "address", "service_name", "worker_name", "labor_name", "notes", "booking_date", "booking_time", "amount", "status", "created_at"];
let knownBookingColumnsCache = null;

async function knownBookingColumns() {
  if (knownBookingColumnsCache) return knownBookingColumnsCache;
  const { data } = await supabase.from("bookings").select("*").limit(1);
  const keys = data && Array.isArray(data) && data.length ? Object.keys(data[0]) : [];
  knownBookingColumnsCache = keys.length ? keys : CORE_BOOKING_COLUMNS;
  return knownBookingColumnsCache;
}

async function filterBookingPayload(booking) {
  const known = await knownBookingColumns();
  const out = {};
  for (const k of Object.keys(booking)) {
    if (known.includes(k)) out[k] = booking[k];
  }
  return out;
}

async function getBookings(status) {
  if (useDatabase) {
    try {
      let query = supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (status && status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      if (!isMissingTable(err)) throw err;
    }
  }
  let list = [...memoryBookings];
  if (status && status !== "all") list = list.filter((b) => b.status === status);
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function getBookingById(id) {
  if (useDatabase) {
    try {
      const { data, error } = await supabase.from("bookings").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    } catch (err) {
      if (!isMissingTable(err)) throw err;
    }
  }
  return memoryBookings.find((b) => b.id === id);
}

async function createBooking(body) {
  const booking = {
    id: body.id || uuidv4(),
    service_id: body.service_id || null,
    worker_id: body.worker_id || null,
    user_name: body.user_name || body.customer_name || body.name || "",
    user_phone: body.user_phone || body.customer_phone || "",
    customer_email: body.customer_email || "",
    address: body.address || "",
    service_name: body.service_name || "",
    worker_name: body.worker_name || body.labor_name || "",
    labor_name: body.labor_name || body.worker_name || "",
    notes: body.notes || "",
    booking_date: body.booking_date || null,
    booking_time: body.booking_time || "",
    amount: Number(body.amount) || 0,
    visiting_fee: Number(body.visiting_fee) || 0,
    booking_type: body.booking_type === "inspection" ? "inspection" : "fixed",
    status: body.status || "pending",
    created_at: body.created_at || new Date().toISOString(),
  };
  if (useDatabase) {
    try {
      const insertable = await filterBookingPayload(booking);
      const { data, error } = await supabase.from("bookings").insert([insertable]).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      if (!isMissingTable(err)) throw err;
    }
  }
  memoryBookings.unshift(booking);
  return booking;
}

async function updateBooking(id, updates) {
  if (useDatabase) {
    try {
      const { data, error } = await supabase.from("bookings").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      if (!isMissingTable(err)) throw err;
    }
  }
  const idx = memoryBookings.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  memoryBookings[idx] = { ...memoryBookings[idx], ...updates };
  return memoryBookings[idx];
}

async function deleteBooking(id) {
  if (useDatabase) {
    try {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
      return true;
    } catch (err) {
      if (!isMissingTable(err)) throw err;
    }
  }
  memoryBookings = memoryBookings.filter((b) => b.id !== id);
  return true;
}

async function getStats() {
  const services = await getServices();
  const workers = await getWorkers();
  const bookings = await getBookings("all");
  const reviews = [];
  for (const w of workers) {
    const wr = await getReviews(w.id);
    reviews.push(...wr);
  }
  const totalRevenue = bookings.filter((b) => b.status === "completed").reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const avgOrderValue = bookings.length ? Math.round(totalRevenue / (bookings.filter((b) => b.status === "completed").length || 1)) : 0;
  return {
    totalRevenue,
    totalBookings: bookings.length,
    activeWorkers: workers.filter((w) => w.status !== "inactive").length,
    avgOrderValue,
    totalServices: services.length,
    totalReviews: reviews.length,
    bookingsByStatus: {
      pending: bookings.filter((b) => b.status === "pending").length,
      assigned: bookings.filter((b) => b.status === "assigned").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    },
  };
}

// Services
app.get("/api/services", async (req, res) => {
  try {
    const services = await getServices();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/services/:category", async (req, res) => {
  try {
    const service = await getServiceByCategory(req.params.category);
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/services", async (req, res) => {
  try {
    const service = { id: uuidv4(), ...req.body };
    const created = await createService(service);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/services/:id", async (req, res) => {
  try {
    const updated = await updateService(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Service not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/services/:id", async (req, res) => {
  try {
    await deleteService(req.params.id);
    res.json({ message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Workers
app.get("/api/workers", async (req, res) => {
  try {
    const serviceId = req.query.service_id || null;
    const workers = await getWorkers(serviceId);
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/workers/:id", async (req, res) => {
  try {
    const worker = await getWorkerById(req.params.id);
    if (!worker) return res.status(404).json({ error: "Worker not found" });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/workers", upload.fields([{ name: "photo", maxCount: 1 }, { name: "id_card", maxCount: 1 }]), async (req, res) => {
  try {
    const worker = { id: uuidv4(), ...req.body };
    worker.experience = parseInt(worker.experience) || 0;
    worker.rating = parseFloat(worker.rating) || 0;
    worker.hourly_rate = parseFloat(worker.hourly_rate) || 0;
    worker.skill = worker.skill || "";
    worker.skill_level = worker.skill_level || "beginner";
    worker.status = worker.status || "active";
    if (req.files && req.files.photo) {
      worker.photo_url = "/uploads/" + req.files.photo[0].filename;
    }
    if (req.files && req.files.id_card) {
      worker.id_card_url = "/uploads/" + req.files.id_card[0].filename;
    }
    const created = await createWorker(worker);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/workers/:id", upload.fields([{ name: "photo", maxCount: 1 }, { name: "id_card", maxCount: 1 }]), async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.experience) updates.experience = parseInt(updates.experience);
    if (updates.rating) updates.rating = parseFloat(updates.rating);
    if (updates.hourly_rate !== undefined) updates.hourly_rate = parseFloat(updates.hourly_rate) || 0;
    if (req.files && req.files.photo) {
      updates.photo_url = "/uploads/" + req.files.photo[0].filename;
    }
    if (req.files && req.files.id_card) {
      updates.id_card_url = "/uploads/" + req.files.id_card[0].filename;
    }
    const updated = await updateWorker(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: "Worker not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/workers/:id", async (req, res) => {
  try {
    await deleteWorker(req.params.id);
    res.json({ message: "Worker deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reviews
app.get("/api/reviews/:workerId", async (req, res) => {
  try {
    const reviews = await getReviews(req.params.workerId);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const review = { id: uuidv4(), ...req.body, created_at: new Date().toISOString() };
    const created = await createReview(review);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload endpoint
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: "/uploads/" + req.file.filename });
});

// Stats
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bookings
app.get("/api/bookings", async (req, res) => {
  try {
    const status = req.query.status || "all";
    const bookings = await getBookings(status);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/bookings/:id", async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const booking = { id: uuidv4(), ...req.body, created_at: new Date().toISOString() };
    const created = await createBooking(booking);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    const updated = await updateBooking(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Booking not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    await deleteBooking(req.params.id);
    res.json({ message: "Booking deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin page (separate ERP dashboard)
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
