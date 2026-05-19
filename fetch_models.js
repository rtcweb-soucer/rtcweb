async function test() {
  const url = "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyCdip8yN1Nh0rQh0aTW2Zkl3yOTwdzGncg";
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
