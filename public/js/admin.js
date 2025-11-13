async function whoAmI() {
  try {
    const r = await fetch('/me');
    if (!r.ok) throw new Error('failed');
    const j = await r.json();
    const el = document.getElementById('whoami');
    if (j.username) {
      el.textContent = `Logged in as: ${j.username} (dev: ${j.isDev})`;
    } else {
      el.textContent = 'Not logged in';
    }
  } catch (e) {
    console.error(e);
    document.getElementById('whoami').textContent = 'Error fetching user';
  }
}

async function login() {
  const username = document.getElementById('u').value;
  const password = document.getElementById('p').value;

  try {
    const r = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const j = await r.json();
    if (j.success) {
      alert('Login OK');
    } else {
      alert('Login failed');
    }
  } catch (e) {
    console.error(e);
    alert('Login error');
  } finally {
    whoAmI();
  }
}

async function logout() {
  try {
    await fetch('/logout', { method: 'POST' });
  } catch (e) {
    console.error(e);
  } finally {
    whoAmI();
  }
}

async function addApt() {
  const name = document.getElementById('name').value.trim();
  const price = Number(document.getElementById('price').value);
  const sqft = Number(document.getElementById('sqft').value);
  const beds = Number(document.getElementById('beds').value);
  const baths = Number(document.getElementById('baths').value);
  const d1 = Number(document.getElementById('d1').value);
  const d2 = Number(document.getElementById('d2').value);
  const url = document.getElementById('url').value.trim();

  if (!name) {
    alert('Name is required');
    return;
  }
  if (Number.isNaN(price) || Number.isNaN(sqft) || Number.isNaN(beds) ||
      Number.isNaN(baths) || Number.isNaN(d1) || Number.isNaN(d2)) {
    alert('Please fill in all numeric fields');
    return;
  }

  const body = {
    name,
    price,
    square_footage: sqft,
    bedrooms: beds,
    bathrooms: baths,
    distance1: d1,
    distance2: d2,
    url: url || null
  };

  try {
    const r = await fetch('/apartments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (r.ok) {
      alert('Apartment added');
      // optionally clear form
      ['name','price','sqft','beds','baths','d1','d2','url'].forEach(id => {
        document.getElementById(id).value = '';
      });
    } else {
      const text = await r.text();
      console.error(text);
      alert('Add failed');
    }
  } catch (e) {
    console.error(e);
    alert('Add error');
  }
}

async function delApt() {
  const idStr = document.getElementById('delId').value;
  const id = Number(idStr);
  if (!idStr || Number.isNaN(id)) {
    alert('Please enter a valid ID');
    return;
  }

  try {
    const r = await fetch('/apartments/' + id, { method: 'DELETE' });
    if (r.ok) {
      alert('Deleted');
      document.getElementById('delId').value = '';
    } else {
      const text = await r.text();
      console.error(text);
      alert('Delete failed');
    }
  } catch (e) {
    console.error(e);
    alert('Delete error');
  }
}

document.getElementById('login').onclick = login;
document.getElementById('logout').onclick = logout;
document.getElementById('addBtn').onclick = addApt;
document.getElementById('delBtn').onclick = delApt;

whoAmI();
