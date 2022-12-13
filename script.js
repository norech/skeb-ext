const artistsProcessing = [];
const artistsProcessed = [];

let artistCommInfo = window.sessionStorage.getItem("_skeb_comminfos_ext")
    ? JSON.parse(window.sessionStorage.getItem("_skeb_comminfos_ext")) : {};

function fetchArtistCommissionInfos(artist) {
    return new Promise(async (resolve, reject) => {

        if (artistsProcessing.includes(artist)) {
            while (!artistCommInfo[artist]) {
                console.log("waiting for " + artist);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            resolve(artistCommInfo[artist]);
            return;
        }

        const frame = document.createElement('iframe');
        frame.src = "https://skeb.jp/@" + artist + "/order";
        frame.style.display = 'none';

        artistsProcessing.push(artist);

        document.body.appendChild(frame);
        frame.onload = function() {
            setTimeout(() => {
                const artistData = {
                    open: false,
                    following: false,
                    price: undefined
                };

                const doc = frame.contentDocument;
                const sidebar = doc.querySelector(".column.is-3");
                const requestButton = sidebar.querySelector(".button.is-primary");
                const isFollowing = Array.from(sidebar.querySelectorAll(".button.is-info")).find(e => e.innerText.includes("Following"));
                if (!requestButton || !requestButton.innerText.includes("New request")) {
                    artistCommInfo[artist] = artistData;
                    artistsProcessed.push(artist);
                    resolve(artistData);
                    document.body.removeChild(frame);
                    return;
                }
                artistData.open = true;
                artistData.following = isFollowing != undefined;
                const table = sidebar.querySelector(".table");
                let type = "";
                for (const row of table.querySelectorAll("tr")) {
                    const cols = row.querySelectorAll("td");
                    const key = cols[0].innerText;
                    const value = cols[1].innerText;
                    if (key.includes("Genre")) {
                        type = value.includes("Artwork") ? "artwork" : "other";
                    }
                    if (key.includes("amount")) {
                        if (type !== "artwork")
                            continue;
                        artistData.price = parseInt(value.replace(/[^0-9]/g, ""));
                    }
                }

                artistCommInfo[artist] = artistData;
                artistsProcessed.push(artist);
                resolve(artistData);
                document.body.removeChild(frame);
            }, 2000);
        };
    });
}

function getArtistCommissionInfos(artist) {
    if (artistCommInfo[artist])
        return Promise.resolve(artistCommInfo[artist]);

    return fetchArtistCommissionInfos(artist).then(artistData => {
        window.sessionStorage.setItem("_skeb_comminfos_ext", JSON.stringify(artistCommInfo));
        return artistData;
    });
}

const listen = async () => {
    let i = 0;

    for (const link of document.querySelectorAll(".column a[href^='/@']")) {
        if (!link.href.includes("/works/"))
            continue;

        if (!link.innerText.includes("Seeking"))
            continue;

        if (link.querySelector(".comminfos") || link.classList.contains("skeb-ext-processing"))
            continue;

        link.classList.add("skeb-ext-processing");

        let artistName = new URL(link.href).pathname.split("/")[1].substring(1);

        if (!artistCommInfo[artistName]) {
            if ((i % 10) == 0)
                await new Promise(resolve => setTimeout(resolve, 2000));
            i++;
        }

        const priceDiv = document.createElement("div");
        link.querySelector('.card').appendChild(priceDiv);
        priceDiv.innerText = "Loading...";
        getArtistCommissionInfos(artistName).then(artistData => {
            priceDiv.classList.add("comminfos");
            console.log(artistData);
            const priceConv = (artistData.price / 100.0 * 0.73).toFixed(2) + "€";
            priceDiv.innerHTML = (artistData.following ? "F" : "U") + " - "
                + (artistData.open && artistData.price != undefined
                ? ("OPEN - JPY " + artistData.price + " (~" + priceConv + ")")
                : "CLOSED");
        });
    }


};

setTimeout(listen, 2000);

const observer = new MutationObserver(listen);

observer.observe(document.body, {
    childList: true,
    subtree: true
});
