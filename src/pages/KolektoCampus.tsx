import React, { useRef, useEffect, useState } from "react";
import { motion, useInView, useAnimation } from "framer-motion";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer/Footer";
import image from "../assets/kolekto-on-campus.png";
import collectionSvg from "../assets/collector-svg.svg";
import {
  ArrowRight,
  CheckCircle,
  Gift,
  Rocket,
  HeadsetIcon,
  Search,
  X,
} from "lucide-react";

// Nigerian universities list (truncated for brevity, use your full list)
const nigerianUniversities = [
  "1-Con Universal Polytechnic, Osogbo",
  "A.D. Rufa’i College for Islamic and Legal Studies - Bauchi (State College of Education)",
  "AL HIKMA COLLEGE OF EDUCATION, ANKPA - Kogi (Private College of Education)",
  "Abdu Gusau Polytechnic, Talata Mafara",
  "Abdulkadir Kure University, Niger",
  "Abdullahi Maikano College of Education, Wase - Plateau (Private College of Education)",
  "Abia State Polytechnic, Aba",
  "Abia State University, Abia",
  "Abia State University, Uturu",
  "Abraham Adesanya Polytechnic, Ijebu-Igbo",
  "Abubakar Garba Zagada- Zagada College of Education, Bajoga - Gombe (Private College of Education)",
  "Abubakar Tafawa Balewa University, Bauchi",
  "Abubakar Tatari Ali Polytechnic, Bauchi",
  "Abubakar Tatari Polytechnic - Bauchi (Polytechnics offering NCE)",
  "Achievers University, Owo",
  "Adamawa State Polytechnic, Yola",
  "Adamawa State University, Adamawa",
  "Adamawa State University, Mubi",
  "Adamu Augie College of Education, Argungu - Kebbi (State College of Education)",
  "Adamu Garkuwa COE, Toro - Bauchi (Private College of Education)",
  "Adamu Tafawa Balewa COE, Kangere - Bauchi (State College of Education)",
  "Adekunle Ajasin University, Akungba",
  "Adekunle Ajasin University, Ondo",
  "Adeleke University, Ede",
  "Adeseun Ogundoyin Polytechnic, Eruwa",
  "Adesina College of Education, Share, Kwara State - Kwara (Private College of Education)",
  "Adeyemi College of Education - Ondo, Ondo State",
  "Adeyemi Federal University of Education, Ondo",
  "Adigrace COE, Byepyi - Taraba (Private College of Education)",
  "Admiralty University Ibusa, Delta State",
  "Admiralty University of Nigeria",
  "Afe Babalola University",
  "Afe Babalola University, Ado-Ekiti - Ekiti State",
  "African Aviation and Aerospace University",
  "African Church College of Education, Ifako Ijaye - Lagos (Private College of Education)",
  "African Thinkers Community of Inquiry COE, Enugu - Enugu (Private College of Education)",
  "African Univeristy of Science and Technology",
  "African University of Science and Technology, Abuja",
  "Ahlus-Suffah COE, Ira - Kaduna (Private College of Education)",
  "Ahmadu Bello University, Kaduna",
  "Ahmadu Bello University, Zaria",
  "Air Force Institute of Technology (AFIT), Airforce Base, Kaduna",
  "Air Force Institute of Technology, Kaduna",
  "Ajayi Crowther University, Ibadan",
  "Ajayi Crowther University, Oyo",
  "Ajayi Polytechnic, Ara-Ekiti",
  "Ajetumobi COE, Ira - Kwara (Private College of Education)",
  "Akanu Ibiam Federal Polytechnic, Unwana-Afikpo",
  "Akwa Ibom State College of Arts & Science, Nung Ukim",
  "Akwa Ibom State College of Education, Afahansit - Akwa Ibom (State College of Education)",
  "Akwa Ibom State Polytechnic, Ikot Osurua",
  "Akwa Ibom State University, Akwa Ibom",
  "Akwa Ibom State University, Uyo",
  "Al-Hikma Polytechnic, Karu",
  "Al-Hikmah University, Ilorin",
  "Al-Ibadan COE - Ibadan (Private College of Education)",
  "Al-Iman College of Education - Plateau (Private College of Education)",
  "Al-Istiqama University, Sumaila, Kano State",
  "Al-Madinah COE Oshogbo - Osun (Private College of Education)",
  "Al-Mustafa College of Education, Kano - Kano (Private College of Education)",
  "Al-Qalam University, Katsina",
  "Al-Ummah COE (UMCOED) - Osun (Private College of Education)",
  "Al-fajr College of Education, Kano - Kano (Private College of Education)",
  "Alex Ekwueme Federal University Ndufu Alike Ikwo, Ebonyi",
  "Alex Ekwueme Federal University, Ndufu-Alike",
  "Alex Ekwueme University, Ndufu-Alike, Ebonyi State",
  "Aliko Dangote University of Science and Technology, Kano",
  "Allover Central Polytechnic, Sango-Ota",
  "Alvan Ikoku Federal College of Education - Owerri, Imo State",
  "Alvan Ikoku Federal University of Education, Owerri, Imo State",
  "Ambrose Alli University, Edo",
  "Ambrose Alli University, Ekpoma",
  "Ameenuddeen College of Education - Kano (Private College of Education)",
  "Ameer Shehu Idris College of Advanced Studies, Zaria - Kaduna (Private College of Education)",
  "American University of Nigeria, Yola",
  "Aminu Kano College of Education - Kano (Private College of Education)",
  "Aminu Kano College of Islamic and Legal Studies - Kano (NTI & Other NCE Awarding Institutions)",
  "Aminu Sale College of Education, Azare - Bauchi",
  "Anambra State Polytechnic, Mgbakwu",
  "Anambra State University, Uli",
  "Anchor University, Ayobo Lagos State",
  "Angel Crown COE - FCT Abuja (Private College of Education)",
  "Annur College of Education Kano - Kano (Private College of Education)",
  "Ansar-Ud-Deen College of Education, Isolo - Lagos (Private College of Education)",
  "Apa COE, Aido - Benue (Private College of Education)",
  "Archbishop Alexander Ibezim COE, Anambra - Anambra (Private College of Education)",
  "Arthur Jarvis University, Calabar",
  "Arthur Javis University, Akpoyubo Cross River State",
  "Ashi Polytechnic, Anyin",
  "Assanusiya COE, Odeomu, Osun - Osun (Private College of Education)",
  "Atiba University, Oyo",
  "Auchi Polytechnic, Auchi",
  "Augustine University, Ilara, Lagos",
  "Ave Maria University, Piyanko, Nasarawa State",
  "Awori District COE - Ogun (Private College of Education)",
  "BETHEL COE IJARE, ONDO - Ondo (Private College of Education)",
  "Babcock University, Ilishan-Remo",
  "Bauchi Institute for Arabic and Islamic Studies - Bauchi (NTI & Other NCE Awarding Institutions)",
  "Bauchi State University, Bauchi",
  "Bauchi State University, Gadau",
  "Bayelsa Medical University, Bayelsa",
  "Bayelsa State Polytechnic, Aleibiri, Bayelsa",
  "Bayero University, Kano",
  "Bayo Tijani COE, Lagos - Lagos (Private College of Education)",
  "Baze University, Abuja",
  "Bellarks Polytechnic, Kwale",
  "Bells University of Technology, Ota",
  "Bells University of Technology, Otta",
  "Benjamin Uwajumogu (State) College of Education, Ihitte Uboma - Imo (State College of Education)",
  "Benson Idahosa University, Benin City",
  "Benue State Polytechnic, Ugbokolo",
  "Benue State University, Benue",
  "Benue State University, Makurdi",
  "Best Legacy COE Ogbomoso - Oyo (Private College of Education)",
  "Best Solution Polytechnic, Akure",
  "Biga College of Education - Sokoto (Private College of Education)",
  "Bingham University, Karu",
  "Bingham University, New Karu",
  "Binyaminu Usman Polytechnic, Hadejia",
  "Bogoro College of Education - Bauchi (Private College of Education)",
  "Bolmor Polytechnic, Ibadan",
  "Borno State University, Borno",
  "Bowen University, Iwo",
  "Brainfill Polytechnic, Ikot-Ekpene",
  "British Transatlantic Polytechnic, Akure",
  "Bukar Abba Ibrahim University, Damaturu",
  "Bukar Abba Ibrahim University, Yobe",
  "COASTLINE COLLEGE OF EDUCATION",
  "COASTLINE COLLEGE OF EDUCATION, Ondo, Private College of Education",
  "COE, Ero, Akure, Ondo, Private College of Education",
  "COE, Moro, Ife-North, Osun, Private College of Education",
  "CRESTFIELD COLLEGE OF EDUCATION, Osun, Private College of Education",
  "Caleb University, Lagos",
  "Calvary Polytechnic, Owo-Oyibu, Delta State",
  "Calvin Foundation COE - Benue (Private College of Education)",
  "Caritas University, Enugu",
  "Chrisland University, Abeokuta",
  "Chrisland University, Abeokuta, Ogun",
  "Christian Chukwuma Onoh COE - Enugu (Private College of Education)",
  "Christian College of Education, Gombe - Gombe (Private College of Education)",
  "Christopher University, Mowe",
  "Chukwuemeka Odumegwu Ojukwu University, Anambra",
  "Chukwuemeka Odumegwu Ojukwu University, Uli",
  "Citi Polytechnic, Abuja",
  "City College of Education, Mararaba - FCT Abuja (Private College of Education)",
  "Claretian University of Nigeria, Nekede, Imo State",
  "Clifford University, Owerrinta Abia State",
  "Climax College of Education, Bauchi - Bauchi (Private College of Education)",
  "Coal City University, Enugu State",
  "Coastal Polytechnic, Badagry",
  "College of Administration, Management And Technology, Potiskum",
  "College of Agriculture, Science And Technology, Gujba",
  "College of Agriculture, Science and Technology, Lafia",
  "College of Education (Technical), Dass, Bauchi, State College of Education",
  "College of Education Akwanga, Nasarawa, State College of Education",
  "College of Education Ilemona, Kwara, Private College of Education",
  "College of Education Kura, Kano, Private College of Education",
  "College of Education Oju, Benue, State College of Education",
  "College of Education Oro, Kwara, State College of Education",
  "College of Education and Legal, Nguru, Yobe, State College of Education",
  "College of Education llorin, Kwara, State College of Education",
  "College of Education, Arochukwu, Abia, State College of Education",
  "College of Education, Billiri, Gombe, State College of Education",
  "College of Education, Darazo, Bauchi, Private College of Education",
  "College of Education, Dutsen Tanshi, Bauchi, Private College of Education",
  "College of Education, Gindiri, Plateau, State College of Education",
  "College of Education, Hong, Yola, State College of Education",
  "College of Education, Ikere-Ekiti, Ekiti, State College of Education",
  "College of Education, Ila-Orangun, Osun State, Osun, State College of Education",
  "College of Education, Waka BIU, Borno, State College of Education",
  "College of Education, Warri, Delta, State College of Education",
  "College of Education, Zing, Taraba, State College of Education",
  "College of Education, katsina-Ala, Benue, State College of Education",
  "Community COE, Kano, Kano, Private College of Education",
  "Corner Stone College of Education, Ikeja, Lagos, Private College of Education",
  "Corona COE Lekki, Lagos, Private College of Education",
  "Covenant College of Education (CCOE), Abia, Private College of Education",
  "Covenant Polytechnic, Aba",
  "Covenant University, Ota",
  "Crawford University, Igbesa",
  "Crescent Pearls Technical College of Education, Abuja, FCT Abuja, Private College of Education",
  "Crescent University, Abeokuta",
  "Cross River Institute of Technology And Management, Ugep",
  "Cross River State Coll. of Education, Akampa, Cross River, State College of Education",
  "Cross River University of Technology, Calabar",
  "Crown Polytechnic, Ado-Ekiti",
  "D.S. Adegbenro ICT Polytechnic, Itori-Ewekoro",
  "DIAMOND COLLEGE OF EDUCATION, ABA, Abia, Private College of Education",
  "Dala College of Education, Kano, Kano, Private College of Education",
  "Danyaya College of Education, Ningi, Bauchi, Private College of Education",
  "David Nweze Umahi Federal University of Medical Sciences, Uburu",
  "Delar College of Education, Oyo, Private College of Education",
  "Delta State College of Education, Mosogar, Delta, State College of Education",
  "Delta State Polytechnic, Ogwashi-Uku",
  "Delta State Polytechnic, Otefe-Oghara",
  "Delta State Polytechnic, Ozoro, Delta State (Now Delta State University of Science And Technology)",
  "Delta State School of Marine Technology, Burutu",
  "Delta State University of Science and Technology, Delta",
  "Delta State University, Abraka",
  "Dennis Osadebay University, Delta",
  "Distinct Polytechnic, Ekosin",
  "Dominican University, Ibadan",
  "Dominican University, Ibadan Oyo State",
  "Dominion University, Ibadan, Oyo State",
  "Dorben Polytechnic Bwari",
  "Dorben Polytechnic, Abuja",
  "Doviana COE, Gboko, Benue, Private College of Education",
  "Dreamville Limited University, Abuja",
  "ECWA COE Igbaja, Kwara, Private College of Education",
  "ECWA COE, Bayara, Bauchi, Private College of Education",
  "ECWA College of Education, Jos (ECOEJ), Plateau (Private College of Education)",
  "Edexcel College of Education, Benue (Private College of Education)",
  "Edo State College of Education, Igueben, Edo (State College of Education)",
  "Elder Oyama Memorial COE, Ofat, Cross River (Private College of Education)",
  "Elibest College of Education, Ondo (Private College of Education)",
  "Elizabeth Memorial College of Education Nsukka, Enugu (Private College of Education)",
  "Emamor College of Education, Rivers (Private College of Education)",
  "Emirate College of Education, Bauchi (Private College of Education)",
  "Emmanuel Ebije Ikwue College Of Education, Benue (Private College of Education)",
  "Enugu State Coll. of Education (T), Enugu, Enugu (State College of Education)",
  "FCT College of Education, Zuba, FCT Abuja (State College of Education)",
  "Federal College of Education (FCE) Gwoza, Borno (Federal College of Education)",
  "Federal College of Education (Special), Oyo, Oyo (Federal College of Education)",
  "Federal College of Education (T), ISU Ebonyi State, Ebonyi (Federal College of Education)",
  "Federal College of Education (T), Umunze, Anambra (Federal College of Education)",
  "Federal College of Education (Tech), Potiskum, Yobe (Federal College of Education)",
  "Federal College of Education (Technical) in Yauri, Kebbi (Federal College of Education)",
  "Federal College of Education (Technical), Akoka, Lagos (Federal College of Education)",
  "Federal College of Education (Technical), Asaba, Delta (Federal College of Education)",
  "Federal College of Education (Technical), Bichi, Kano (Federal College of Education)",
  "Federal College of Education (Technical), Gombe, Gombe (Federal College of Education)",
  "Federal College of Education (Technical), Gusau, Zamfara (Federal College of Education)",
  "Federal College of Education, Abeokuta, Ogun State (Federal College of Education)",
  "Federal College of Education, Eha-Amufu, Enugu State (Federal College of Education)",
  "Federal College of Education, Kano, Kano State (Federal College of Education)",
  "Federal College of Education, Kontagora, Niger State (Federal College of Education)",
  "Federal College of Education, Obudu, Cross River State (Federal College of Education)",
  "Federal College of Education, Okene, Kogi State (Federal College of Education)",
  "Federal College of Education, Pankshin, Plateau State (Federal College of Education)",
  "Federal College of Education, Yola, Adamawa State (Federal College of Education)",
  "Federal College of Education, Zaria, Kaduna State (Federal College of Education)",
  "Federal Polytechnic Ado-Ekiti, Ekiti State",
  "Federal Polytechnic Ayede, Osun State",
  "Federal Polytechnic Bali, Taraba State",
  "Federal Polytechnic Bauchi, Bauchi State",
  "Federal Polytechnic Bida, Niger State",
  "Federal Polytechnic Daura, Katsina State",
  "Federal Polytechnic Damaturu, Yobe State",
  "Federal Polytechnic Ede, Osun State",
  "Federal Polytechnic Ekowe, Bayelsa State",
  "Federal Polytechnic Idah, Kogi State",
  "Federal Polytechnic Ilaro, Ogun State",
  "Federal Polytechnic Ile-Oluji, Ondo State",
  "Federal Polytechnic Isuochi, Abia State",
  "Federal Polytechnic Kabo, Kano State",
  "Federal Polytechnic Kaltungo, Gombe State",
  "Federal Polytechnic Kaura-Namoda, Zamfara State",
  "Federal Polytechnic Monguno, Borno State",
  "Federal Polytechnic Mubi, Adamawa State",
  "Federal Polytechnic Nasarawa, Nasarawa State",
  "Federal Polytechnic Neede, Benue State",
  "Federal Polytechnic Nyak Shendam, Plateau State",
  "Federal Polytechnic of Oil and Gas Bonny, Rivers State",
  "Federal Polytechnic Offa, Kwara State",
  "Federal Polytechnic Ohodo, Enugu State",
  "Federal Polytechnic Oko, Anambra State",
  "Federal Polytechnic Orogun, Delta State",
  "Federal Polytechnic Ukana, Akwa Ibom State",
  "Federal Polytechnic Ugep, Cross River State",
  "Federal Polytechnic Wannune, Benue State",
  "Federal University of Agriculture Abeokuta, Ogun State",
  "Federal University of Applied Sciences Kachia, Kaduna State",
  "Federal University Birnin Kebbi, Kebbi State",
  "Federal University Dutse, Jigawa State",
  "Federal University Dutsin-Ma, Katsina State",
  "Federal University Gashua, Yobe State",
  "Federal University Gusau, Zamfara State",
  "Federal University Kashere, Gombe State",
  "Federal University Lokoja, Kogi State",
  "Federal University of Lafia, Nasarawa State",
  "Federal University of Petroleum Resources Effurun, Delta State",
  "Federal University of Technology Akure, Ondo State",
  "Federal University of Technology Minna, Niger State",
  "Federal University of Technology Owerri, Imo State",
  "Federal University Otuoke, Bayelsa State",
  "Federal University Oye-Ekiti, Ekiti State",
  "Federal University Wukari, Taraba State",
  "Hussaini Adamu Federal Polytechnic, Kazaure, Jigawa State",
  "Kaduna Polytechnic, Kaduna State",
  "Maritime Academy of Nigeria, Oron, Cross River State",
  "Michael Okpara University of Agriculture Umudike, Abia State",
  "Modibbo Adama University Yola, Adamawa State",
  "National Open University of Nigeria, Victoria Island, Lagos State",
  "Nnamdi Azikiwe University Awka, Anambra State",
  "Obafemi Awolowo University Ile Ife, Osun State",
  "University of Abuja, Gwagwalada / Airport Road, FCT",
  "University of Agriculture Makurdi, Benue State",
  "University of Benin Benin City, Edo State",
  "University of Calabar Calabar, Cross River State",
  "University of Ibadan Ibadan, Oyo State",
  "University of Ilorin Ilorin, Kwara State",
  "University of Jos Jos, Plateau State",
  "University of Lagos Akoka, Lagos State",
  "University of Maiduguri Maiduguri, Borno State",
  "University of Nigeria Nsukka Nsukka, Enugu State",
  "University of Port Harcourt Port Harcourt, Rivers State",
  "University of Uyo Uyo, Akwa Ibom State",
  "Usmanu Danfodiyo University Sokoto, Sokoto State",
  "Gateway Polytechnic Saapade, Ogun State",
  "Gombe State Polytechnic, Bajoga, Gombe State",
  "Hassan Usman Katsina Polytechnic, Katsina State",
  "Imo State Polytechnic Umuagwo, Imo State",
  "Institute of Management And Technology Enugu, Enugu State",
  "Isa Mustapha Agwai Polytechnic Lafia, Nasarawa State",
  "Jigawa State Polytechnic Dutse, Jigawa State",
  "Kano State Polytechnic Kano, Kano State",
  "Katsina Institute of Technology And Management, Katsina State",
  "Kenule Beeson Saro-Wiwa Polytechnic Bori, Rivers State",
  "Kogi State Polytechnic Lokoja, Kogi State",
  "Kwara State Polytechnic Ilorin, Kwara State",
  "Lagos State Polytechnic Ikorodu (Now Lagos State University of Science and Technology), Lagos State",
  "Mai-Idris Alooma Polytechnic Geidam, Yobe State",
  "Moshood Abiola Polytechnic Abeokuta, Ogun State",
  "Niger State Polytechnic Zungeru, Niger State",
  "Nuhu Bamalli Polytechnic Zaria, Kaduna State",
  "Ogun State Institute of Technology Igbesa, Ogun State",
  "Ogun State Polytechnic Ipokia, Ogun State",
  "Osun State College of Technology Esa-Oke, Osun State",
  "Osun State Polytechnic Iree, Osun State",
  "Oyo State College of Agriculture And Technology Igbo-Ora, Oyo State",
  "Plateau State Polytechnic Barkin-Ladi, Plateau State",
  "Port-Harcourt Polytechnic Port-Harcourt, Rivers State",
  "Ramat Polytechnic Maiduguri, Borno State",
  "Abdu Gusau Polytechnic Talata Mafara, Zamfara State",
  "Abia State Polytechnic Aba, Abia State",
  "Akwa Ibom State College of Arts & Science Nung Ukim, Akwa Ibom State",
  "Akwa Ibom State Polytechnic Ikot Osurua, Akwa Ibom State",
  "Anambra State Polytechnic Mgbakwu, Anambra State",
  "Benue State Polytechnic Ugbokolo, Benue State",
  "Binyaminu Usman Polytechnic Hadejia, Jigawa State",
  "College of Agriculture Science And Technology Gujba, Yobe State",
  "College of Administration Management And Technology Potiskum, Yobe State",
  "Cross River Institute of Technology And Management Ugep, Cross River State",
  "Delta State Polytechnic Ogwashi-Uku, Delta State",
  "Delta State Polytechnic Otefe-Oghara, Delta State",
  "Delta State School of Marine Technology Burutu, Delta State",
  "D.S. Adegbenro ICT Polytechnic Itori-Ewekoro, Ogun State",
  "Edo State Polytechnic Usen, Edo State",
  "Ekiti State College of Agriculture And Technology Isan-Ekiti, Ekiti State",
  "Enugu State Polytechnic Iwollo, Enugu State",
  "Tazkiyah University, Kaduna State",
  "Leadership University, Abuja",
  "Jimoh Babalola University, Kwara State",
  "Bridget University, Mbaise, Imo State",
  "Greenland University, Jigawa State",
  "JEFAP University, Niger State",
  "Azione Verde University, Imo State",
  "Unique Open University, Lagos State",
  "American Open University, Ogun State",
  "Abdulkadir Kure University, Minna, Niger State",
  "Abia State University, Uturu, Abia State",
  "Adamawa State University, Mubi, Adamawa State",
  "Adekunle Ajasin University, Akungba-Akoko, Ondo State",
  "Akwa Ibom State University, Uyo, Akwa Ibom State",
  "Aliko Dangote University of Science and Technology, Wudil, Kano State",
  "Ambrose Alli University, Ekpoma, Edo State",
  "Bauchi State University, Gadau, Bauchi State",
  "Bayelsa Medical University, Yenagoa, Bayelsa State",
  "Benue State University, Makurdi, Benue State",
  "Borno State University, Maiduguri, Borno State",
  "Bukar Abba Ibrahim University, Damaturu, Yobe State",
  "Chukwuemeka Odumegwu Ojukwu University, Uli, Anambra State",
  "University of Cross River State Ekpo-Abasi Calabar, Cross River State",
  "Delta State University Abraka, Delta State",
  "Delta State University of Science and Technology Ozoro, Delta State",
  "Dennis Osadebay University Asaba, Delta State",
  "Ebonyi State University, Abakaliki, Ebonyi State",
  "Edo State University Uzairue Iyamho, Edo State",
  "Ekiti State University Ado Ekiti, Ekiti State",
  "Enugu State University of Science and Technology Enugu, Enugu State",
  "Gombe State University Gombe, Gombe State",
  "Gombe State University of Science and Technology Kumo, Gombe State",
  "Ibrahim Badamasi Babangida University Lapai, Niger State",
  "Ignatius Ajuru University of Education Port Harcourt, Rivers State",
  "Imo State University Owerri, Imo State",
  "Kaduna State University Kaduna, Kaduna State",
  "Kebbi State University of Science and Technology Aliero, Kebbi State",
  "Prince Abubakar Audu University Anyigba, Kogi State",
  "Kwara State University Malete, Kwara State",
  "Ladoke Akintola University of Technology Ogbomoso, Oyo State",
  "Lagos State University Ojo, Lagos State",
  "Lagos State University of Education Ijanikin, Lagos State",
  "Lagos State University of Science and Technology Ikorodu, Lagos State",
  "Nasarawa State University Keffi, Nasarawa State",
  "Niger Delta University Amassoma, Bayelsa State",
  "Olabisi Onabanjo University Ago-Iwoye, Ogun State",
  "Olusegun Agagu University of Science and Technology Okitipupa, Ondo State",
  "Osun State University Osogbo, Osun State",
  "Plateau State University Bokkos, Plateau State",
  "Rivers State University Port Harcourt, Rivers State",
  "Sule Lamido University Kafin-Hausa, Jigawa State",
  "Tai Solarin University of Education Ijebu Ode, Ogun State",
  "Taraba State University Jalingo, Taraba State",
  "The Technical University Ibadan, Oyo State",
  "Umaru Musa Yar'adua University Katsina, Katsina State",
  "University of Abuja Abuja, FCT",
  "University of Agriculture Makurdi, Benue State",
  "University of Benin Benin City, Edo State",
  "University of Calabar Calabar, Cross River State",
  "University of Ibadan Ibadan, Oyo State",
  "University of Ilorin Ilorin, Kwara State",
  "University of Jos Jos, Plateau State",
  "University of Lagos Lagos, Lagos State",
  "University of Maiduguri Maiduguri, Borno State",
  "University of Medical Sciences Ondo, Ondo State",
  "University of Mkar Gboko, Benue State",
  "University of Nigeria Nsukka, Enugu State",
  "University of Port Harcourt Port Harcourt, Rivers State",
  "University of Uyo Uyo, Akwa Ibom State",
  "Usmanu Danfodiyo University Sokoto, Sokoto State",
  "Veritas University Abuja, FCT",
  "Wellspring University Benin City, Edo State",
  "Wesley University of Science and Technology Ondo, Ondo State",
  "Western Delta University Oghara, Delta State",
  "Yobe State University Damaturu, Yobe State",
  "Yusuf Maitama Sule University Kano, Kano State",
];

export default function KolektoCampusSignup() {
  // Animation controls
  const controls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  // State for form
  const [selectedCampus, setSelectedCampus] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [controls, isInView]);

  // Handle campus selection change
  const handleCampusChange = (university) => {
    setSelectedCampus(university);
    setSearchTerm(university);
    setIsDropdownOpen(false);
    setShowOtherInput(university === "Other (Please specify)");
  };

  // Filter universities based on search term
  const filteredUniversities = nigerianUniversities.filter((university) =>
    university.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Clear search and close dropdown
  const clearSearch = () => {
    setSearchTerm("");
    setSelectedCampus("");
    setIsDropdownOpen(true);
  };

  // Framer Motion variants
  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  const staggerChildren = {
    visible: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-neutral-50 font-sans text-neutral-800 overflow-x-hidden">
      <NavBar />

      {/* Account Notice Banner */}
      <div className="w-full bg-amber-50 border-b border-amber-200 py-3 px-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 text-sm">
          <span className="text-amber-800 font-medium">
            Don't have a Kolekto account yet?
          </span>
          <a
            href="/register"
            className="text-green-800 font-bold hover:underline flex items-center"
          >
            Sign up first to get started
            <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1">
        {/* HERO */}
        <section className="relative py-16 sm:py-24 overflow-hidden" id="hero">
          {/* Animated background elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <motion.div
              className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-emerald-100 opacity-50"
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 10, 0],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute top-1/3 -right-16 w-40 h-40 rounded-full bg-amber-100 opacity-40"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -15, 0],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
            />
            <motion.div
              className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-green-800 opacity-30"
              animate={{
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }}
            />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <motion.div
                className="text-center lg:text-left"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7 }}
              >
                <motion.div
                  className="inline-flex items-center space-x-3 text-sm lg:text-base font-medium mb-5 bg-white rounded-full py-1.5 px-4 shadow-sm border border-emerald-100"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span>Power Your</span>
                  <span className="flex items-center gap-2 bg-green-800 text-white px-3 py-1 rounded-full">
                    <img
                      height={16}
                      width={16}
                      src={collectionSvg}
                      alt="collection"
                      className="text-white"
                    />
                    Collection
                  </span>
                </motion.div>

                <motion.h1
                  className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl md:text-5xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Be Among the First to Use{" "}
                  <span className="text-green-800">Kolekto</span> on Your Campus
                </motion.h1>

                <motion.p
                  className="mt-6 text-lg text-amber-600 font-medium"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  Join the Kolekto Campus Community and unlock exclusive
                  benefits just for students.
                </motion.p>

                <motion.div
                  className="mt-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <motion.a
                    className="inline-flex items-center rounded-full bg-green-800 text-white px-8 py-4 text-base font-bold shadow-lg hover:bg-green-950 transition-colors"
                    href="#form-section"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Sign Up for Kolekto Campus
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </motion.a>
                </motion.div>
              </motion.div>

              <motion.div
                className="flex justify-center"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
              >
                <div className="relative">
                  <motion.div
                    className="absolute -inset-4 bg-green-800 rounded-2xl -z-10"
                    animate={{
                      rotate: [0, 3, 0],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.img
                    src={image}
                    alt="Students using Kolekto app"
                    className="max-w-md w-full rounded-2xl shadow-xl"
                    whileHover={{
                      scale: 1.02,
                      transition: { duration: 0.3 },
                    }}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* WHY JOIN */}
        <section className="py-16 sm:py-24 bg-white" id="why-join">
          <div className="container mx-auto px-6">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                Why Join Kolekto Campus?
              </h2>
              <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">
                Exclusive benefits designed specifically for students to make
                group payments easier and more rewarding.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
              variants={staggerChildren}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              ref={ref}
            >
              {[
                {
                  icon: <HeadsetIcon className="h-8 w-8" />,
                  title: "Priority Support",
                  desc: "Get dedicated support to help you with any questions or issues.",
                  color: "emerald",
                  gradient: false,
                },
                {
                  icon: <Gift className="h-8 w-8" />,
                  title: "Campus Perks",
                  desc: "Unlock exclusive rewards and offers tailored for students on campus.",
                  color: "amber",
                  gradient: false,
                },
                {
                  icon: <Rocket className="h-8 w-8" />,
                  title: "Early Access",
                  desc: "Be the first to experience new features and updates before they're released.",
                  color: "emerald",
                  gradient: true,
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeIn}
                  className="group relative overflow-hidden rounded-2xl bg-white p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full bg-green-800 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />

                  <motion.div
                    className={`relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                      item.gradient
                        ? "bg-gradient-to-r from-emerald-600 to-amber-300 text-white"
                        : `bg-${item.color}-100 text-${item.color}-600`
                    } mb-6 group-hover:scale-110 transition-transform duration-300`}
                    whileHover={{ rotate: 5 }}
                  >
                    {item.icon}
                  </motion.div>

                  <h3 className="relative z-10 mt-6 text-xl font-bold text-neutral-900">
                    {item.title}
                  </h3>
                  <p className="relative z-10 mt-3 text-neutral-600">
                    {item.desc}
                  </p>

                  <motion.div
                    className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-800 to-amber-200 origin-left"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 + idx * 0.1 }}
                    viewport={{ once: true }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* FORM SECTION */}
        <section
          className="py-16 sm:py-24 bg-gradient-to-br from-green-700 to-green-900"
          id="form-section"
        >
          <div className="container mx-auto max-w-2xl px-6">
            <motion.div
              className="bg-white rounded-3xl p-8 sm:p-12 shadow-2xl border border-green-800/20"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-neutral-900">
                  Join Your Campus Community
                </h2>
                <p className="mt-3 text-neutral-600">
                  Sign up now to get exclusive access and benefits
                </p>
              </div>

              <form className="space-y-6">
                {[
                  {
                    id: "first-name",
                    label: "First Name",
                    type: "text",
                    placeholder: "Enter your first name",
                  },
                  {
                    id: "surname",
                    label: "Surname",
                    type: "text",
                    placeholder: "Enter your surname",
                  },
                  {
                    id: "email",
                    label: "Email (same as Kolekto sign-up)",
                    type: "email",
                    placeholder: "Enter your email",
                  },
                  {
                    id: "whatsapp",
                    label: "WhatsApp Number",
                    type: "tel",
                    placeholder: "Enter your WhatsApp number",
                  },
                ].map((field, idx) => (
                  <motion.div
                    key={field.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    viewport={{ once: true }}
                  >
                    <label
                      className="block text-sm font-medium text-neutral-700 mb-2"
                      htmlFor={field.id}
                    >
                      {field.label}
                    </label>
                    <div className="mt-1">
                      <input
                        className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-14 px-5 border transition-colors hover:border-emerald-300"
                        id={field.id}
                        name={field.id}
                        placeholder={field.placeholder}
                        type={field.type}
                      />
                    </div>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  viewport={{ once: true }}
                >
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-2"
                    htmlFor="campus-search"
                  >
                    Campus
                  </label>
                  <div className="mt-1 space-y-2 relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search for your campus..."
                        className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-14 pl-10 pr-10 border transition-colors hover:border-emerald-300"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={clearSearch}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-white border border-gray-200 shadow-lg"
                      >
                        <div className="py-1">
                          {filteredUniversities.length > 0 ? (
                            filteredUniversities.map((university, index) => (
                              <button
                                key={index}
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors"
                                onClick={() => handleCampusChange(university)}
                              >
                                {university}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-gray-500">
                              No universities found. Try a different search
                              term.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {showOtherInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.3 }}
                        className="mt-2"
                      >
                        <input
                          type="text"
                          placeholder="Please specify your campus"
                          className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-14 px-4 border transition-colors hover:border-emerald-300"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  viewport={{ once: true }}
                >
                  <motion.button
                    className="w-full flex justify-center items-center rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-800 px-8 py-4 text-lg font-bold text-white shadow-lg hover:shadow-xl transition-all hover:from-emerald-700 hover:to-emerald-900"
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Join Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </motion.button>
                </motion.div>
              </form>
            </motion.div>
          </div>
        </section>

        {/* INCENTIVES */}
        <section className="py-16" id="incentives-banner">
          <div className="container mx-auto px-6">
            <motion.div
              className="relative rounded-3xl bg-gradient-to-br from-green-700 to-green-900 p-8 sm:p-12 text-center text-white overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              {/* Animated background elements */}
              <div className="absolute inset-0 overflow-hidden">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full bg-white opacity-10"
                    style={{
                      width: Math.random() * 100 + 50,
                      height: Math.random() * 100 + 50,
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                    }}
                    animate={{
                      scale: [0, 1.5, 0],
                      opacity: [0, 0.1, 0],
                    }}
                    transition={{
                      duration: Math.random() * 5 + 5,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                    }}
                  />
                ))}
              </div>

              <div className="relative z-10 ">
                <h2 className="text-2xl sm:text-3xl font-bold">
                  Join our exclusive support group and{" "}
                  <span className="text-amber-300">earn perks</span> as you grow
                  with Kolekto.
                </h2>

                <motion.div
                  className="mt-8 inline-flex flex-wrap justify-center gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  viewport={{ once: true }}
                >
                  {[
                    "Early access to new features",
                    "Exclusive campus events",
                    "Priority customer support",
                    "Special rewards program",
                  ].map((benefit, idx) => (
                    <motion.div
                      key={idx}
                      className="flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2"
                      whileHover={{ scale: 1.05 }}
                    >
                      <CheckCircle className="h-5 w-5 mr-2 text-amber-300" />
                      <span>{benefit}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
