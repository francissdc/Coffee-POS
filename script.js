let products = [];
let currentBasket = [];
let processedOrders = [];
let searchFilterQuery = "";
let isEditMode = false;
let currentUserRole = localStorage.getItem("userRole") || "staff";
let currentUserName = localStorage.getItem("userName") || "Staff";

window.addEventListener("DOMContentLoaded", async () => {
  if (!localStorage.getItem("userRole")) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("sidebar-admin-name").textContent = currentUserName;
  document.getElementById("sidebar-cashier-name").textContent = `Role: ${currentUserRole.toUpperCase()}`;
  document.getElementById("user-initials").textContent = currentUserName.charAt(0);

  if (currentUserRole === "manager") {
    document.getElementById("edit-mode-container").classList.remove("hidden");
    document.getElementById("edit-mode-container").classList.add("flex");
    
    const salesControls = document.getElementById("manager-sales-controls");
    if (salesControls) salesControls.classList.remove("hidden");
  }

  initClock();

  const savedProducts = localStorage.getItem("managerProducts");
  if (savedProducts) {
    products = JSON.parse(savedProducts);
    buildProductCatalogue();
  } else {
    try {
      const response = await fetch("products.json");
      products = await response.json();
      localStorage.setItem("managerProducts", JSON.stringify(products));
      buildProductCatalogue();
    } catch (error) {
      console.error("Error loading products:", error);
      triggerToast("Failed to load menu items.");
    }
  }

  const savedOrders = localStorage.getItem("processedOrders");
  if (savedOrders) {
    processedOrders = JSON.parse(savedOrders);
    renderHistoryTable();
  }

  renderBasketDom();
  updateBadgesCount();
  lucide.createIcons();

  document.getElementById("search-input").addEventListener("input", (e) => {
    searchFilterQuery = e.target.value;
    buildProductCatalogue();
  });
});

function logoutUser() {
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
  window.location.href = "login.html";
}

function initClock() {
  setInterval(() => {
    document.getElementById("live-clock").textContent = new Date().toLocaleTimeString();
  }, 1000);
}

function switchTab(targetTab) {
  ["menu", "orders", "history"].forEach((tab) => {
    const btn = document.getElementById(`nav-${tab}`);
    if (tab === targetTab) {
      btn.className = "sidebar-btn w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-semibold text-[15px] bg-[#D4A574] text-[#261C14] shadow-lg";
    } else {
      btn.className = "sidebar-btn w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-medium text-[15px] text-[#C4B5A5] hover:bg-white/5 hover:text-white";
    }
  });

  document.getElementById("view-menu").classList.toggle("hidden", targetTab !== "menu");
  document.getElementById("view-orders").classList.toggle("hidden", targetTab !== "orders");
  document.getElementById("view-history").classList.toggle("hidden", targetTab !== "history");

  if (targetTab === "orders") renderKitchenOrdersView();
  if (targetTab === "history") renderHistoryTable();
}

function buildProductCatalogue() {
  const container = document.getElementById("products-market-floor");
  container.innerHTML = "";

  if (isEditMode && currentUserRole === "manager") {
    const addBox = document.createElement("div");
    addBox.className = "mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between";
    addBox.innerHTML = `
      <div>
        <h4 class="font-bold text-sm text-amber-900">Manager Menu Control</h4>
        <p class="text-xs text-amber-700">You can edit prices, delete items, or add new products to the catalogue.</p>
      </div>
      <button onclick="addNewProductPrompt()" class="px-4 py-2 bg-[#3E2F23] text-white text-xs font-bold rounded-xl hover:bg-[#5B4636]">
        + Add New Product
      </button>
    `;
    container.appendChild(addBox);
  }

  const groups = [...new Set(products.map((p) => p.category))];

  groups.forEach((cat) => {
    const items = products.filter((p) => p.category === cat && p.name.toLowerCase().includes(searchFilterQuery.toLowerCase()));
    if (items.length === 0) return;

    const section = document.createElement("div");
    section.innerHTML = `
      <h3 class="text-xs font-bold uppercase tracking-wider text-[#A0826D] border-b pb-2 mb-4 font-serif">${cat}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6"></div>
    `;
    const grid = section.querySelector(".grid");

    items.forEach((product) => {
      const defaultVariant = product.defaultVariant || "none";
      const initialPrice = product.prices[defaultVariant] || product.prices["none"] || 0;

      let variantHTML = "";
      if (product.variants && product.variants.length > 0) {
        variantHTML += `<div class="flex gap-1.5 mt-2 bg-[#FAF7F2] p-1 rounded-lg border">`;
        product.variants.forEach((v, index) => {
          const vPrice = product.prices[v] || initialPrice;
          variantHTML += `<button onclick="changeVariant(event,'${product.id}','${v}',${vPrice})" id="vbtn-${product.id}-${v}" class="flex-1 text-[10px] py-1 rounded-md uppercase ${index === 0 ? "bg-white font-bold" : "text-[#7A6552]"}">${v}</button>`;
        });
        variantHTML += `</div>`;
      }

      const card = document.createElement("div");
      card.className = "bg-white rounded-2xl border p-4 flex flex-col justify-between hover:shadow-lg transition-all relative";
      card.innerHTML = `
        <div onclick="addBasketItem('${product.id}')" class="cursor-pointer">
          <div class="w-full h-40 rounded-xl overflow-hidden bg-[#FAF7F2] mb-3 relative">
            <img src="${product.image}" class="w-full h-full object-cover">
          </div>
          <h4 class="font-bold text-sm">${product.name}</h4>
          <p class="text-xs text-[#7A6552] mt-1">${product.description}</p>
        </div>
        <div class="mt-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold" id="price-display-${product.id}">₱${initialPrice}.00</span>
            <button onclick="addBasketItem('${product.id}')" class="w-8 h-8 rounded-xl bg-[#3E2F23] text-white flex items-center justify-center">+</button>
          </div>
          <input type="hidden" id="selected-variant-${product.id}" value="${defaultVariant}" />
          ${variantHTML}
          
          ${isEditMode && currentUserRole === "manager" ? `
            <div class="mt-3 pt-3 border-t flex gap-2">
              <button onclick="editPrice('${product.id}', event)" class="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs rounded-lg font-semibold text-gray-700">Edit Price</button>
              <button onclick="deleteProduct('${product.id}', event)" class="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-xs rounded-lg font-semibold text-red-600">Delete</button>
            </div>
          ` : ""}
        </div>
      `;
      grid.appendChild(card);
    });
    container.appendChild(section);
  });
  lucide.createIcons();
}

function changeVariant(event, productId, variant, price) {
  event.stopPropagation();
  document.getElementById(`selected-variant-${productId}`).value = variant;
  document.getElementById(`price-display-${productId}`).textContent = `₱${price}.00`;
}

function addBasketItem(productId) {
  const product = products.find((p) => p.id === productId);
  const variant = document.getElementById(`selected-variant-${productId}`).value;
  const price = product.prices[variant] || product.prices["none"] || 0;

  const existing = currentBasket.find((i) => i.product.id === productId && i.variant === variant);
  if (existing) {
    existing.quantity += 1;
  } else {
    currentBasket.push({ cartItemId: Date.now() + Math.random(), product, variant, price, quantity: 1 });
  }
  renderBasketDom();
  triggerToast("Item added to basket");
}

function renderBasketDom() {
  const container = document.getElementById("cart-items-container");
  container.innerHTML = "";
  if (currentBasket.length === 0) {
    container.innerHTML = `<p class="text-center text-sm text-gray-400 py-10">Basket is empty</p>`;
    document.getElementById("cart-indicator-badge").classList.add("hidden");
  } else {
    let totalItems = 0;
    currentBasket.forEach((item) => {
      totalItems += item.quantity;
      container.innerHTML += `
        <div class="flex justify-between items-center bg-white p-3 rounded-xl border text-xs">
          <div><b>${item.product.name}</b> (${item.variant}) x${item.quantity}</div>
          <div class="font-bold">₱${item.price * item.quantity}.00</div>
        </div>
      `;
    });
    document.getElementById("cart-indicator-badge").textContent = totalItems;
    document.getElementById("cart-indicator-badge").classList.remove("hidden");
  }

  const subtotal = currentBasket.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountType = document.getElementById("discount-select") ? document.getElementById("discount-select").value : "none";
  
  let discountAmount = 0;
  if (discountType === "sc_pwd") {
    discountAmount = subtotal * 0.20;
  } else if (discountType === "student") {
    discountAmount = subtotal * 0.10;
  }

  const grandTotal = subtotal - discountAmount;

  if (document.getElementById("price-summary-subtotal")) {
    document.getElementById("price-summary-subtotal").textContent = `₱${subtotal.toFixed(2)}`;
    document.getElementById("price-summary-discount").textContent = `-₱${discountAmount.toFixed(2)}`;
    document.getElementById("price-summary-grand").textContent = `₱${grandTotal.toFixed(2)}`;
  }
}

function toggleCartPanel() {
  const panel = document.getElementById("cart-panel");
  const back = document.getElementById("cart-backdrop");
  panel.classList.toggle("translate-x-full");
  back.classList.toggle("hidden");
  back.classList.toggle("opacity-100");
}

function submitOrderTicket() {
  const customer = document.getElementById("customer-name-field").value.trim();
  if (!customer) { triggerToast("Please enter customer name!"); return; }
  if (currentBasket.length === 0) { triggerToast("Basket is empty!"); return; }

  const subtotal = currentBasket.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountType = document.getElementById("discount-select").value;
  let discountAmount = 0;
  if (discountType === "sc_pwd") discountAmount = subtotal * 0.20;
  if (discountType === "student") discountAmount = subtotal * 0.10;
  const grandTotal = subtotal - discountAmount;

  const order = {
    id: "ORD-" + Math.floor(100000 + Math.random() * 900000),
    timestamp: new Date(),
    customer,
    items: [...currentBasket],
    subtotal,
    discountType,
    discountAmount,
    total: grandTotal,
    status: "Preparing"
  };

  processedOrders.unshift(order);
  localStorage.setItem("processedOrders", JSON.stringify(processedOrders));
  currentBasket = [];
  document.getElementById("customer-name-field").value = "";
  renderBasketDom();
  toggleCartPanel();
  
  showReceiptModal(order);
  triggerToast("Order processed successfully!");
}

function showReceiptModal(order) {
  const content = document.getElementById("receipt-modal-content");
  let itemsHTML = "";
  order.items.forEach(i => {
    itemsHTML += `<div class="flex justify-between"><span>${i.quantity}x ${i.product.name} (${i.variant})</span><span>₱${i.price * i.quantity}.00</span></div>`;
  });

  content.innerHTML = `
    <div class="text-center border-b pb-2">
      <h3 class="font-bold text-sm">COFFEE EVERYDAY</h3>
      <p class="text-[10px]">Official Receipt</p>
    </div>
    <div class="space-y-1 text-[11px]">
      <div><b>Order ID:</b> ${order.id}</div>
      <div><b>Customer:</b> ${order.customer}</div>
      <div><b>Date/Time:</b> ${new Date(order.timestamp).toLocaleString()}</div>
    </div>
    <div class="border-y border-dashed py-2 space-y-1 text-[11px]">
      ${itemsHTML}
    </div>
    <div class="space-y-1 text-[11px]">
      <div class="flex justify-between"><span>Subtotal:</span><span>₱${order.subtotal.toFixed(2)}</span></div>
      <div class="flex justify-between"><span>Discount (${order.discountType}):</span><span>-₱${order.discountAmount.toFixed(2)}</span></div>
      <div class="flex justify-between font-bold text-xs pt-1 border-t"><span>Total Due:</span><span>₱${order.total.toFixed(2)}</span></div>
    </div>
    <div class="text-center pt-2 text-[10px] text-gray-500">Thank you for your purchase!</div>
  `;

  document.getElementById("receipt-modal").classList.remove("hidden");
}

function closeReceiptModal() {
  document.getElementById("receipt-modal").classList.add("hidden");
}

function renderKitchenOrdersView() {
  const prepGrid = document.getElementById("preparing-orders-grid");
  const readyGrid = document.getElementById("ready-orders-grid");
  
  if (prepGrid) prepGrid.innerHTML = "";
  if (readyGrid) readyGrid.innerHTML = "";

  const preparingOrders = processedOrders.filter(o => o.status === "Preparing");
  if (preparingOrders.length === 0 && prepGrid) {
    prepGrid.innerHTML = `<p class="text-xs text-gray-400 italic">No orders currently preparing.</p>`;
  } else if (prepGrid) {
    preparingOrders.forEach(o => {
      prepGrid.innerHTML += `
        <div class="border border-[#E8E2D5] p-4 rounded-xl space-y-2 bg-[#FAF7F2]">
          <div class="flex justify-between items-center">
            <h4 class="font-bold text-sm">${o.customer}</h4>
            <span class="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold">${o.id}</span>
          </div>
          <button onclick="markReady('${o.id}')" class="w-full py-2 bg-[#E6A06A] hover:bg-[#d8915b] text-white rounded-lg text-xs font-bold transition-all">
            Mark as Ready
          </button>
        </div>
      `;
    });
  }

  const readyOrders = processedOrders.filter(o => o.status === "Ready");
  if (readyOrders.length === 0 && readyGrid) {
    readyGrid.innerHTML = `<p class="text-xs text-gray-400 italic">No orders ready for pickup.</p>`;
  } else if (readyGrid) {
    readyOrders.forEach(o => {
      readyGrid.innerHTML += `
        <div class="border border-emerald-200 p-4 rounded-xl space-y-2 bg-emerald-50/50">
          <div class="flex justify-between items-center">
            <h4 class="font-bold text-sm text-emerald-900">${o.customer}</h4>
            <span class="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">${o.id}</span>
          </div>
          <button onclick="markCompleted('${o.id}')" class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all">
            Complete Order
          </button>
        </div>
      `;
    });
  }
}

function markReady(id) {
  const order = processedOrders.find(o => o.id === id);
  if (order) {
    order.status = "Ready";
    localStorage.setItem("processedOrders", JSON.stringify(processedOrders));
    renderKitchenOrdersView();
    updateBadgesCount();
    triggerToast("Order marked as ready for pickup!");
  }
}

function markCompleted(id) {
  const order = processedOrders.find(o => o.id === id);
  if (order) {
    order.status = "Completed";
    localStorage.setItem("processedOrders", JSON.stringify(processedOrders));
    renderKitchenOrdersView();
    updateBadgesCount();
    if (document.getElementById("view-history") && !document.getElementById("view-history").classList.contains("hidden")) {
      renderHistoryTable();
    }
    triggerToast("Order completed!");
  }
}

function renderHistoryTable() {
  const tbody = document.getElementById("history-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  let totalSales = 0;

  processedOrders.forEach(o => {
    totalSales += o.total;
    const formattedDate = new Date(o.timestamp).toLocaleString();
    tbody.innerHTML += `
      <tr class="border-b text-xs">
        <td class="p-4 font-mono font-bold">${o.id}</td>
        <td class="p-4 text-gray-600">${formattedDate}</td>
        <td class="p-4">${o.customer}</td>
        <td class="p-4 font-bold">₱${o.total.toFixed(2)}</td>
        <td class="p-4 text-right"><span class="px-2 py-1 rounded-md bg-gray-100 font-semibold">${o.status}</span></td>
      </tr>
    `;
  });

  const salesEl = document.getElementById("daily-sales-total");
  if (salesEl) {
    salesEl.textContent = `₱${totalSales.toFixed(2)}`;
  }
}

// Manager Feature: Print Sales Summary Report
function printSalesSummary() {
  if (currentUserRole !== "manager") {
    alert("Access denied: Only managers can print sales reports.");
    return;
  }

  let totalSales = 0;
  processedOrders.forEach(o => totalSales += o.total);

  const content = document.getElementById("sales-modal-content");
  content.innerHTML = `
    <div class="text-center border-b pb-2">
      <h3 class="font-bold text-sm">COFFEE EVERYDAY</h3>
      <p class="text-[10px]">Daily Sales Summary Report</p>
    </div>
    <div class="space-y-1 text-[11px] py-2">
      <div><b>Generated By:</b> ${currentUserName} (Manager)</div>
      <div><b>Date:</b> ${new Date().toLocaleDateString()}</div>
      <div><b>Total Transactions:</b> ${processedOrders.length}</div>
    </div>
    <div class="border-y border-dashed py-3 space-y-1 text-[11px]">
      <div class="flex justify-between font-bold text-xs"><span>Total Gross Sales:</span><span>₱${totalSales.toFixed(2)}</span></div>
    </div>
    <div class="text-center pt-2 text-[10px] text-gray-500">End of Day Sales Report</div>
  `;

  document.getElementById("sales-print-modal").classList.remove("hidden");
}

function closeSalesModal() {
  document.getElementById("sales-print-modal").classList.add("hidden");
}

function clearOrderHistory() {
  if (currentUserRole !== "manager") {
    alert("Access denied: Only managers can clear order history.");
    return;
  }
  if (confirm("Are you sure you want to clear all order history and reset daily sales?")) {
    processedOrders = [];
    localStorage.removeItem("processedOrders");
    renderHistoryTable();
    updateBadgesCount();
    triggerToast("Order history cleared.");
  }
}

function updateBadgesCount() {
  const active = processedOrders.filter((o) => o.status === "Preparing").length;
  const badge = document.getElementById("active-orders-badge");
  if (badge) {
    if (active > 0) { 
      badge.textContent = active; 
      badge.classList.remove("hidden"); 
    } else { 
      badge.classList.add("hidden"); 
    }
  }
}

function triggerToast(msg) {
  const toast = document.getElementById("system-toast");
  if (!toast) return;
  document.getElementById("system-toast-text").textContent = msg;
  toast.classList.remove("opacity-0");
  toast.classList.add("opacity-100");
  setTimeout(() => { toast.classList.remove("opacity-100"); toast.classList.add("opacity-0"); }, 2000);
}

function toggleEditMode() {
  if (currentUserRole !== "manager") return;
  isEditMode = !isEditMode;
  document.getElementById("edit-mode-actions").classList.toggle("hidden");
  document.getElementById("edit-mode-actions").classList.toggle("flex");
  buildProductCatalogue();
}

function editPrice(productId, event) {
  event.stopPropagation();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const currentVal = product.prices.none !== undefined ? product.prices.none : (product.prices.iced || 0);
  const newPrice = prompt(`Enter new price for ${product.name}:`, currentVal);
  
  if (newPrice !== null && !isNaN(newPrice) && newPrice.trim() !== "") {
    const val = Number(newPrice);
    if (product.prices.none !== undefined) {
      product.prices.none = val;
    } else {
      if (product.prices.iced !== undefined) product.prices.iced = val;
      if (product.prices.hot !== undefined) product.prices.hot = val;
    }
    
    localStorage.setItem("managerProducts", JSON.stringify(products));
    buildProductCatalogue();
    triggerToast("Price updated successfully!");
  }
}

function deleteProduct(productId, event) {
  event.stopPropagation();
  if (confirm("Are you sure you want to remove this product from the menu?")) {
    products = products.filter(p => p.id !== productId);
    localStorage.setItem("managerProducts", JSON.stringify(products));
    buildProductCatalogue();
    triggerToast("Product removed from menu.");
  }
}

function addNewProductPrompt() {
  const name = prompt("Enter product name:");
  if (!name) return;
  const category = prompt("Enter category (e.g., Coffee, Croffles, Cakes):", "Coffee");
  if (!category) return;
  const priceInput = prompt("Enter price:", "150");
  if (!priceInput || isNaN(priceInput)) return;
  const description = prompt("Enter short description:", "Delicious item");

  const newProduct = {
    id: "PROD-" + Date.now(),
    name: name.trim(),
    description: description ? description.trim() : "",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
    prices: { none: Number(priceInput) },
    category: category.trim(),
    defaultVariant: "none",
    available: true
  };

  products.push(newProduct);
  localStorage.setItem("managerProducts", JSON.stringify(products));
  buildProductCatalogue();
  triggerToast("New product added successfully!");
}

function saveMenuChanges() { isEditMode = false; toggleEditMode(); triggerToast("Changes saved"); }
function discardMenuChanges() { isEditMode = false; toggleEditMode(); }