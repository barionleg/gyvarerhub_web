function applyUpdate(name, value) {
  if (name in prompts) {
    release_all();
    let res = prompt(value ? value : prompts[name].label, prompts[name].value);
    if (res !== null) {
      prompts[name].value = res;
      set_h(name, res);
    }
    return;
  }
  if (name in confirms) {
    release_all();
    let res = confirm(value ? value : confirms[name].label);
    set_h(name, res ? 1 : 0);
    return;
  }
  if (name in pickers) {
    pickers[name].setColor(intToCol(value));
    return;
  }

  let el = EL('#' + name);
  if (!el) return;
  cl = el.classList;
  if (cl.contains('icon_t')) el.style.color = value;
  else if (cl.contains('text_t')) el.innerHTML = value;
  else if (cl.contains('input_t')) el.value = value;
  else if (cl.contains('date_t')) el.value = new Date(value * 1000).toISOString().split('T')[0];
  else if (cl.contains('time_t')) el.value = new Date(value * 1000).toISOString().split('T')[1].split('.')[0];
  else if (cl.contains('datetime_t')) el.value = new Date(value * 1000).toISOString().split('.')[0];
  else if (cl.contains('slider_t')) el.value = value, EL('out#' + name).innerHTML = value, moveSlider(el, false);
  else if (cl.contains('switch_t')) el.checked = (value == '1');
  else if (cl.contains('select_t')) el.value = value;
  else if (cl.contains('image_t')) hub.dev(focused).addFile(name, value ? value : EL('#' + name).getAttribute("data-path"), 'img', true);
  else if (cl.contains('canvas_t')) {
    if (name in canvases) {
      if (!canvases[name].value) {
        canvases[name].value = value;
        drawCanvas(canvases[name]);
      }
    }
  }
  else if (cl.contains('gauge_t')) {
    if (name in gauges) {
      gauges[name].value = Number(value);
      drawGauge(gauges[name]);
    }
  }
  else if (cl.contains('flags_t')) {
    let flags = document.getElementById('#' + name).getElementsByTagName('input');
    let val = value;
    for (let i = 0; i < flags.length; i++) {
      flags[i].checked = val & 1;
      val >>= 1;
    }
  }
}
