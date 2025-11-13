async function fetchApts() {
  const r = await fetch('/apartments');
  if (!r.ok) {
    throw new Error('Failed to fetch apartments');
  }
  // Expected: { rows: [...], isDev: boolean }
  return r.json();
}

function applyFilters(rows, isDev) {
  const name = document.getElementById('f-name').value.toLowerCase().trim();

  const pmin = Number(document.getElementById('f-price-min').value || 0);
  const pmax = Number(document.getElementById('f-price-max').value || Infinity);

  const smin = Number(document.getElementById('f-sqft-min').value || 0);
  const smax = Number(document.getElementById('f-sqft-max').value || Infinity);

  const bedsStr = document.getElementById('f-beds').value;
  const beds = bedsStr === '' ? null : Number(bedsStr);

  const bathsStr = document.getElementById('f-baths').value;
  const baths = bathsStr === '' ? null : Number(bathsStr);

  const d1max = Number(document.getElementById('f-dist1-max').value || Infinity);

  let d2max = Infinity;
  if (isDev) {
    const d2maxStr = document.getElementById('f-dist2-max').value;
    d2max = d2maxStr === '' ? Infinity : Number(d2maxStr);
  }

  return rows.filter(raw => {
    // Coerce DB values (which are strings) into numbers
    const priceVal = raw.price == null ? null : Number(raw.price);
    const sqftVal = raw.square_footage == null ? null : Number(raw.square_footage);
    const bedsVal = raw.bedrooms == null ? null : Number(raw.bedrooms);
    const bathsVal = raw.bathrooms == null ? null : Number(raw.bathrooms);
    const d1Val = raw.distance1 == null ? null : Number(raw.distance1);
    const d2Val = raw.distance2 == null ? null : Number(raw.distance2);

    // Name filter
    if (name && !raw.name.toLowerCase().includes(name)) return false;

    // Price (skip filter if price is null)
    if (priceVal !== null && (priceVal < pmin || priceVal > pmax)) return false;

    // Sq ft (skip if null, though we always set something)
    if (sqftVal !== null && (sqftVal < smin || sqftVal > smax)) return false;

    // Bedrooms (exact)
    if (beds !== null && bedsVal !== beds) return false;

    // Bathrooms (exact) – THIS is the one that was failing before
    if (baths !== null && bathsVal !== baths) return false;

    // Distance from Castle Rock
    if (d1Val !== null && d1Val > d1max) return false;

    // Distance from Broomfield (dev only)
    if (isDev && d2max !== Infinity && d2Val !== null && d2Val > d2max) {
      return false;
    }

    return true;
  });
}

function renderTable(rows, isDev) {
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = '';

  const thD2 = document.getElementById('th-d2');

  if (isDev) {
    thD2.classList.remove('hidden');
  } else {
    thD2.classList.add('hidden');
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');

    const tdId = document.createElement('td');
    tdId.textContent = row.id;

    const tdName = document.createElement('td');
    tdName.textContent = row.name;

    const tdPrice = document.createElement('td');
    tdPrice.textContent = row.price;

    const tdSqft = document.createElement('td');
    tdSqft.textContent = row.square_footage;

    const tdBeds = document.createElement('td');
    tdBeds.textContent = row.bedrooms;

    const tdBaths = document.createElement('td');
    tdBaths.textContent = row.bathrooms;

    const tdD1 = document.createElement('td');
    tdD1.textContent = row.distance1;

    const tdD2 = document.createElement('td');
    if (isDev) {
      tdD2.textContent = row.distance2;
      tdD2.classList.remove('hidden');
    } else {
      tdD2.textContent = '—';
      tdD2.classList.add('hidden');
    }

    const tdLink = document.createElement('td');
    tdLink.classList.add('table-link');
    if (row.url) {
      const a = document.createElement('a');
      a.href = row.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Click me';
      tdLink.appendChild(a);
    } else {
      tdLink.textContent = '—';
    }

    tr.appendChild(tdId);
    tr.appendChild(tdName);
    tr.appendChild(tdPrice);
    tr.appendChild(tdSqft);
    tr.appendChild(tdBeds);
    tr.appendChild(tdBaths);
    tr.appendChild(tdD1);
    tr.appendChild(tdD2);
    tr.appendChild(tdLink);

    tbody.appendChild(tr);
  });
}

async function init() {
  try {
    const { rows, isDev } = await fetchApts();

    const dist2Field = document.getElementById('dist2-filter-field');
    if (dist2Field) {
      if (isDev) {
        dist2Field.classList.remove('hidden');
      } else {
        dist2Field.classList.add('hidden');
      }
    }

    const doRender = () => {
      const filtered = applyFilters(rows, isDev);
      renderTable(filtered, isDev);
    };

    document.getElementById('apply').onclick = doRender;
    document.getElementById('clear').onclick = () => {
      document.querySelectorAll('#filters input').forEach(i => (i.value = ''));
      doRender();
    };

    doRender();
  } catch (err) {
    console.error(err);
    alert('Error loading apartments');
  }
}

init();
