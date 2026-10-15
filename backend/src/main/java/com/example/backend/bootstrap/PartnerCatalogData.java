package com.example.backend.bootstrap;

import java.util.List;

/** Catalog transcribed from the DS Partner worksheet in MASTER PLAN Beauty Link - EXE201.xlsx. */
final class PartnerCatalogData {
    private PartnerCatalogData() {}

    static List<PartnerEntry> partners() {
        return List.of(
                partner("tham-my-hien-tran", "Thẩm mỹ Hiền Trần", "Hiền Trần", "Chuyên viên Hiền Trần",
                        "Thẩm mỹ & phun xăm", "252 Xuân Khanh, Sơn Tây, Hà Nội",
                        "Điều trị da, phun xăm thẩm mỹ và gội dưỡng sinh. Liên hệ: 0977383819.",
                        List.of(
                                service("skincare", "Điều trị mụn", 500_000, 75, "Điều trị mụn - nám", skin(0)),
                                service("skincare", "Điều trị nám", 3_500_000, 90, "Điều trị mụn - nám", skin(1)),
                                service("makeup", "Điêu khắc chân mày (3D/6D/9D)", 6_000_000, 120, "Phun xăm thẩm mỹ", makeup(0)),
                                service("makeup", "Điêu khắc Hairstroke / Gẩy sợi", 8_000_000, 150, "Phun xăm thẩm mỹ", makeup(1)),
                                service("makeup", "Xăm mí", 1_500_000, 60, "Phun xăm thẩm mỹ", makeup(2)),
                                service("makeup", "Phun môi collagen", 5_000_000, 120, "Phun xăm thẩm mỹ", makeup(3)),
                                service("makeup", "Phun môi pha lê", 5_000_000, 120, "Phun xăm thẩm mỹ", makeup(4)),
                                service("makeup", "Phun môi Nano", 7_000_000, 120, "Phun xăm thẩm mỹ", makeup(5)),
                                service("makeup", "Khử thâm môi", 2_500_000, 90, "Phun xăm thẩm mỹ", makeup(6)),
                                service("spa", "Gội thường", 50_000, 30, "Gội đầu", hairWash()),
                                service("spa", "Gội dưỡng sinh", 120_000, 70, "Gội đầu thư giãn", spa(0)))),

                partner("trang-tuti", "Trang Tuti", "Trang Tuti", "Chuyên viên Trang Tuti",
                        "Nail, mi & gội đầu", "260 Xuân Khanh, Tùng Thiện, Hà Nội",
                        "Nail, nối mi và gội đầu. Liên hệ: 0886871591. Facebook: facebook.com/trang.koi.94043.",
                        List.of(
                                service("nails", "Phá gel thường", 20_000, 15, "Dịch vụ nail", nail(0)),
                                service("nails", "Tháo móng giả", 50_000, 30, "Dịch vụ nail", nail(1)),
                                service("nails", "Nhặt da sửa móng", 30_000, 30, "Dịch vụ nail", nail(2)),
                                service("nails", "Sơn gel", 70_000, 45, "Dịch vụ nail", nail(3)),
                                service("nails", "Úp móng", 150_000, 60, "Dịch vụ nail", nail(4)),
                                service("nails", "Sticker", 5_000, 15, "Phụ kiện nail", nail(5)),
                                service("nails", "Nhũ, xà cừ, kim tuyến", 10_000, 15, "Phụ kiện nail", nail(6)),
                                service("nails", "Tráng gương", 5_000, 15, "Phụ kiện nail", nail(7)),
                                service("nails", "Đá khối, charm", 20_000, 15, "Phụ kiện nail", nail(8)),
                                service("makeup", "Uốn mi", 150_000, 60, "Dịch vụ mi", makeup(7)),
                                service("makeup", "Nối mi", 300_000, 75, "Dịch vụ mi", makeup(8)),
                                service("spa", "Gội đầu thường", 30_000, 30, "Dịch vụ gội đầu", spa(1)),
                                service("spa", "Gội đầu cặp", 35_000, 40, "Dịch vụ gội đầu", spa(2)))),

                partner("salon-minh-nhu", "Salon Minh Như", "Minh Như", "Chuyên viên Minh Như",
                        "Hair salon, mi & makeup", "01/150 Phố Thanh Vị, Tùng Thiện, Hà Nội",
                        "Làm tóc, mi và makeup. Liên hệ: 0968108368. Giá dịch vụ theo độ dài và tình trạng tóc.",
                        List.of(
                                ranged("hair", "Cắt tóc", 50_000, 100_000, 45, hair(0)),
                                service("hair", "Gội đầu", 40_000, 30, "Dịch vụ tóc", hair(1)),
                                ranged("hair", "Uốn tóc nữ", 500_000, 2_000_000, 150, hair(2)),
                                ranged("hair", "Uốn tóc nam", 200_000, 500_000, 90, hair(3)),
                                ranged("hair", "Nhuộm tóc nữ", 400_000, 2_500_000, 180, hair(4)),
                                ranged("hair", "Nhuộm tóc nam", 200_000, 1_500_000, 120, hair(5)),
                                ranged("makeup", "Uốn mi", 300_000, 500_000, 60, makeup(9)),
                                ranged("makeup", "Nối mi", 80_000, 300_000, 75, makeup(10)),
                                ranged("makeup", "Makeup", 300_000, 500_000, 90, makeup(11)))),

                partner("diem-huong-cosmetic-beauty", "Diễm Hường Cosmetic Beauty", "Diễm Hường",
                        "Chuyên viên Diễm Hường", "Mỹ phẩm & chăm sóc da", "132 Thanh Vị, Sơn Tây, Hà Nội",
                        "Tư vấn mỹ phẩm chính hãng. Liên hệ: 0842291339. Facebook: facebook.com/khuatdiemhuong.",
                        List.of(onRequest("skincare", "Tư vấn mỹ phẩm chính hãng", 30, skin(2)))),

                partner("nails-art-studio-son-tay", "Nails Art Studio", "Hạnh Nguyễn", "Chuyên viên Hạnh Nguyễn",
                        "Nail, mi & thư giãn", "30 Thanh Vỵ, Thanh Mỹ, Sơn Tây, Hà Nội",
                        "Nail, mi và chăm sóc thư giãn. Liên hệ: 0962222415.",
                        List.of(
                                service("spa", "Gội đầu thư giãn", 35_000, 45, "Chăm sóc thư giãn", spa(3)),
                                service("spa", "Massage cổ - vai - gáy", 70_000, 45, "Chăm sóc thư giãn", spa(4)),
                                service("spa", "Chà gót chân", 50_000, 30, "Chăm sóc chân", spa(5)),
                                service("spa", "Lấy ráy tai", 30_000, 30, "Chăm sóc thư giãn", spa(6)),
                                service("makeup", "Uốn mi", 150_000, 60, "Dịch vụ mi", makeup(12)),
                                service("makeup", "Nối mi", 300_000, 75, "Dịch vụ mi", makeup(13)),
                                service("nails", "Sơn gel", 50_000, 45, "Dịch vụ nail", nail(9)),
                                service("nails", "Úp móng", 120_000, 60, "Dịch vụ nail", nail(10)),
                                service("nails", "Sticker", 7_000, 15, "Phụ kiện nail", nail(11)),
                                service("nails", "Nhũ, xà cừ, kim tuyến", 15_000, 15, "Phụ kiện nail", nail(12)),
                                service("nails", "Tráng gương", 10_000, 15, "Phụ kiện nail", nail(13)),
                                service("nails", "Đá khối, charm", 20_000, 15, "Phụ kiện nail", nail(14)))),

                partner("vien-toc-truk-sky", "Viện tóc Truk Sky", "Anh Trực", "Chuyên viên Trực",
                        "Hair salon", "CS1: 66 Chùa Thông, Sơn Tây; CS2: 164 Xuân Khanh, Sơn Tây, Hà Nội",
                        "Dịch vụ tóc nam và nữ. Liên hệ: 0987395228. Giá thay đổi theo độ dài tóc.",
                        List.of(
                                ranged("hair", "Cắt tóc nữ", 50_000, 150_000, 60, hair(6)),
                                ranged("hair", "Nối tóc nữ", 15_000, 35_000, 180, hair(7)),
                                ranged("hair", "Uốn tóc nữ", 600_000, 1_500_000, 150, hair(8)),
                                ranged("hair", "Nhuộm tóc nữ", 1_500_000, 4_000_000, 180, hair(9)),
                                ranged("hair", "Duỗi tóc sinh học nữ", 800_000, 2_500_000, 180, hair(10)),
                                service("hair", "Cắt tóc nam", 50_000, 45, "Dịch vụ tóc nam", hair(11)),
                                ranged("hair", "Nối tóc nam / tép", 15_000, 35_000, 120, hair(12)),
                                ranged("hair", "Uốn tóc nam", 300_000, 450_000, 90, hair(13)),
                                ranged("hair", "Nhuộm tóc nam", 350_000, 1_200_000, 120, hair(14)),
                                service("hair", "Duỗi tóc sinh học nam", 400_000, 90, "Dịch vụ tóc nam", hair(15)),
                                service("hair", "Gội đầu", 35_000, 30, "Dịch vụ tóc", hair(16)))),

                partner("van-ngan-skincare", "Vân Ngàn", "Vân Ngàn", "Chuyên viên Vân Ngàn",
                        "Tư vấn & chăm sóc da", "Sơn Tây, Hà Nội",
                        "Tư vấn, chăm sóc da mụn, nám, tàn nhang chuẩn y khoa và mỹ phẩm dưỡng da tại nhà. " +
                                "Liên hệ: 0367788585. Facebook: facebook.com/van.ngan.218059.",
                        List.of(onRequest("skincare", "Tư vấn chăm sóc da mụn, nám, tàn nhang", 45, skin(3)))),

                partner("an-yen-spa-wellness", "An Yên Spa - Spa & Wellness", "An Yên Spa",
                        "Chuyên viên An Yên", "Spa & wellness",
                        "CS1: Số 11, ngõ 21 Lê Văn Lương; CS2: 115A, tòa G2 Vinhomes GreenBay, Hà Nội",
                        "Trị liệu, massage và gội đầu dưỡng sinh. Liên hệ: 0973041999 hoặc 0916562889. " +
                                "Facebook: facebook.com/profile.php?id=61571315668447.",
                        List.of(
                                service("spa", "Liệu trình trị liệu đặc trưng An Yên", 599_000, 130, "Liệu trình 130 phút", spa(7)),
                                service("spa", "Combo ngủ ngon", 359_000, 70, "Liệu trình 70 phút", spa(8)),
                                service("spa", "Trị liệu giảm đau mỏi cổ, vai và lưng trên", 499_000, 90, "Liệu trình 90 phút", spa(9)),
                                service("spa", "Gội đầu dưỡng sinh An Yên", 299_000, 70, "Liệu trình 70 phút", spa(10)),
                                onRequest("spa", "Gội đầu thư giãn", 50, spa(11)))),

                partner("cao-rua-mat-face-wash-fox", "Cáo Rửa Mặt - Face Wash Fox", "Face Wash Fox",
                        "Chuyên viên Face Wash Fox", "Facial & skincare",
                        "CS1: 39B Lý Thường Kiệt, Hoàn Kiếm; CS2: 1/27 Long Bích, Đống Đa; " +
                                "CS3: 120 Trần Quốc Vượng, Cầu Giấy; CS4: 25 Trích Sài, Tây Hồ, Hà Nội",
                        "Dịch vụ làm sạch và chăm sóc da. Liên hệ: 0889866666. Facebook: facebook.com/facewashfox.",
                        List.of(
                                service("skincare", "Làm sạch sâu + Cấp ẩm", 779_000, 75, "Chăm sóc da chuyên sâu", skin(4)),
                                service("skincare", "Làm sạch sâu + Cấp ẩm + Săn chắc da", 809_000, 90, "Chăm sóc da chuyên sâu", skin(5)),
                                service("skincare", "Làm sạch sâu + Săn chắc da + Làm sáng da", 999_000, 90, "Chăm sóc da chuyên sâu", skin(6)),
                                service("skincare", "Liệu pháp Meso PDRN", 1_490_000, 90, "Liệu pháp Meso PDRN", skin(7)))),

                partner("hope-hair-studio", "Hope Hair Studio", "Hope Hair Studio", "Chuyên viên Hope Hair Studio",
                        "Hair studio", "Số 78, ngõ 20 Huỳnh Thúc Kháng, Hà Nội",
                        "Làm tóc và phục hồi tóc chuyên sâu. Liên hệ: 0356021997. " +
                                "Facebook: facebook.com/HOPEhairsalon286duonglang.",
                        List.of(
                                service("hair", "Gói cơ bản: Uốn / Duỗi nhiệt / Nhuộm tóc", 400_000, 180, "Gói cơ bản", hair(17)),
                                service("hair", "Gói nâng cao: Uốn / Duỗi nhiệt / Nhuộm tóc", 600_000, 180, "Gói nâng cao", hair(18)),
                                service("hair", "Tẩy tóc", 500_000, 150, "Gói nâng cao", hair(19)),
                                service("hair", "Gói VIP: Uốn / Hấp / Nhuộm / Tẩy tóc", 800_000, 240, "Gói VIP", hair(20)),
                                service("hair", "Uốn phồng chân tóc", 300_000, 90, "Dịch vụ riêng lẻ", hair(21)),
                                service("hair", "Cắt tóc tạo kiểu", 200_000, 60, "Dịch vụ riêng lẻ", hair(22)),
                                ranged("hair", "Chăm sóc, phục hồi ngọn tóc", 300_000, 500_000, 90, hair(23)),
                                ranged("hair", "Duỗi tóc lớp ngoài", 300_000, 500_000, 90, hair(24)),
                                service("hair", "Liệu trình phục hồi Collagen", 350_000, 90, "Phục hồi tóc chuyên sâu", hair(25)),
                                service("hair", "Liệu trình Keratin", 600_000, 120, "Phục hồi tóc chuyên sâu", hair(26)),
                                service("hair", "Liệu trình Olaplex", 900_000, 120, "Phục hồi tóc chuyên sâu", hair(27))))
        );
    }

    private static PartnerEntry partner(String slug, String name, String ownerName, String practitionerName,
            String businessType, String address, String description, List<ServiceEntry> services) {
        return new PartnerEntry(slug, name, ownerName, practitionerName, businessType, address, description, services);
    }

    private static ServiceEntry service(String category, String name, long price, int duration, String group,
            String image) {
        return new ServiceEntry(category, name, price, duration, group, group, image);
    }

    private static ServiceEntry ranged(String category, String name, long minimum, long maximum, int duration,
            String image) {
        String range = "Giá từ " + vnd(minimum) + " đến " + vnd(maximum) + " tùy nhu cầu thực tế";
        return new ServiceEntry(category, name, minimum, duration, range, range, image);
    }

    private static ServiceEntry onRequest(String category, String name, int duration, String image) {
        String message = "Liên hệ cơ sở để được tư vấn và báo giá";
        return new ServiceEntry(category, name, 0, duration, message, message, image);
    }

    private static String vnd(long value) {
        return String.format("%,dđ", value).replace(',', '.');
    }

    private static String nail(int index) { return NAIL_IMAGES[index]; }
    private static String hair(int index) { return HAIR_IMAGES[index]; }
    private static String spa(int index) { return SPA_IMAGES[index]; }
    private static String skin(int index) { return SKIN_IMAGES[index]; }
    private static String makeup(int index) { return MAKEUP_IMAGES[index]; }
    private static String hairWash() {
        return "https://live.staticflickr.com/65535/51213255408_6f57033e09_o.jpg";
    }

    private static final String[] NAIL_IMAGES = {
            "https://www.sytongli.com/uploads/20251202/d59dfda7a0b790834f331d41680adeda.png",
            "https://cdn1.treatwell.net/images/view/v2.i5675393.w1080.h720.x605DD528/",
            "https://dfv9n9rpncj8c.cloudfront.net/category_page/gel_manicure.jpg",
            "https://www.trustamai.com/_next/image?q=75&url=https%3A%2F%2Fpub-37d243ef93cf475ebd3092d44634b7bf.r2.dev%2Fblog%2Fcover%2F721b941a-0818-4d2d-8096-efad12d960c5.png&w=3840",
            "https://klaavee.com/images/nails06.jpg",
            "https://www.houseofnailsandspamaidstone.co.uk/_next/image?q=75&url=https%3A%2F%2Fassets.bookingcampus.com%2Fbc-parties-images%2Fpublic%2F8f9dce34-6d61-4fe7-b6bc-f6c562ba0982%2Fgallery%2Fimg_20251022_wa_0065.jpg&w=384",
            "https://meizi-chao-pub.8531.cn/2001530360247922690_1280px.png?height=960&width=1280",
            "https://nailaura.co.in/images/gallery/nail9.jpg",
            "https://www.preciousnailssalem.com/uploads/images/thu-vien/nail-9-1714701867.jpg",
            "https://live.staticflickr.com/5724/20432253193_f34a27a719.jpg",
            "https://www.011info.com/uploads/Firma/2013/12/26/35892/5.jpg?ver=1667378511",
            "https://baimeihuigz.com/images/nail_art_course.png",
            "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=85",
            "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85",
            "https://live.staticflickr.com/8117/8646898573_69bc80ce84_b.jpg"
    };

    private static final String[] HAIR_IMAGES = {
            "https://images.soco.id/7-7-tahun-loreal-hairducation-3.jpg.jpeg",
            "https://www.laprensa.hn/binrepository/568x400/0c0/0d0/none/11004/MMTI/iStock_000014330007_Large-w905-h600_LP746803_MG79019192.jpg",
            "https://lirp.cdn-website.com/4415ba01/dms3rep/multi/opt/158744057-1920w.jpg",
            "https://cdn.day1company.io/prod/uploads/202308/011946-1093/kr-hairdesigner-sungje-detail-2.webp",
            "https://cdn.job-medley.com/customers/image_files/converted_v1-9c8af12a-c197-449b-8127-723269a33ed7.jpg",
            "https://lirp.cdn-website.com/bc05e820/dms3rep/multi/opt/image%2B%2815%29-640w.png",
            "https://townsquare.media/site/701/files/2023/03/attachment-RS50478_GettyImages-153043805-scr.jpg?q=75&w=1600",
            "https://live.staticflickr.com/2130/2324752738_ffa8613af1.jpg",
            "https://images.fresha.com/lead-images/placeholders/hair-salon-21.jpg",
            "https://images.squarespace-cdn.com/content/64d513ea4f76440b9a846020/4adcf95a-8de7-4a40-a3fd-72030ced162b/gray%2Bcoverage%2Bat%2BThe%2BCutting%2BRoom?content-type=image%2Fjpeg&format=1500w",
            "https://www.kwalifikacjezawodowe.info/img/wo/6/28/Fryzjer-obrazek_sredni_4974628.jpg",
            "https://static9.depositphotos.com/1003098/1153/i/450/depositphotos_11537177-stock-photo-hairdresser-cutting-clients-hair.jpg",
            "https://live.staticflickr.com/7521/16080987202_887e998834_b.jpg",
            "https://live.staticflickr.com/1598/24058950753_c64df0fbe3_b.jpg",
            "https://d50-a.sdn.cz/d_50/c_img_G_C/YJQH0.jpeg?fl=cro%2C0%2C0%2C5354%2C4016%7Cres%2C1200%2C%2C1%7Cjpg%2C80%2C%2C1",
            "https://cabelo.ca/cdn/shop/files/dyeing-hair-of-female-client.png?height=1024&v=1758134780",
            "https://primary.jwwb.nl/pexels/39/3993312.jpeg",
            "https://erp-image.sgliteasset.com/_next/image?q=75&url=https%3A%2F%2Fcdn1.sgliteasset.com%2Fshinehai%2Fimages%2Fblog%2F67a83131425e9.png&w=3840",
            "https://k.sinaimg.cn/n/sinakd10117/778/w964h614/20220124/b6e6-bace6204b7e5be238a796c61ff1535f0.png/w700d1q75cms.jpg",
            "https://welca-hairworks.com/common/upload_data/welca-hairworkscom/image/20211201134800.jpg",
            "https://live.staticflickr.com/530/31754883492_16b2ec6032_b.jpg",
            "https://review-hero.fra1.cdn.digitaloceanspaces.com/64f95458-8e13-418a-8ff3-65105219b673",
            "https://cdn.administrace.tv/2024/11/08/medium/6419b4d5a6b755f8455cef6693518a28.jpg",
            "https://www.hairfinder.com/articles2005/perm-hair-rods-th.jpg",
            "https://live.staticflickr.com/2599/4154227267_3900b726c9_b.jpg",
            "https://images.squarespace-cdn.com/content/v1/578841209de4bb14b3996c32/4019f464-7cb0-4439-b35f-fe1542d06ef9/hair-salon-bowl-image1.jpg",
            "https://www.ched.nl/assets/files/geef-je-haar-de-liefdevolle-aandacht-die-het-verdient-verzorging-kapsalon-rotterdam-kapper.1920x0.jpg",
            "https://www.myvsalonspa.com/images/Los_sorprendentes_beneficios_de_los_tratamientos_capilares_Dale_a_tu_cabello_el_cuidado_que_se_merece001-myvsalonspa.jpg"
    };

    private static final String[] SPA_IMAGES = {
            "https://www.visit-nottinghamshire.co.uk/dbimgs/EDEN-HALL-TREATMENT-2017-173%20-%20Copy.jpg",
            "https://cdn.jumeirah.com/-/mediadh/dh/hospitality/jumeirah/hotels/abu-dhabi/jumeirah-at-saadiyat-island-resort/new-website-content/wellbeing/jsi/spa/jsi_spa_square.jpg?h=960&hash=250B14FC9CA2F13DCA5DD8A24E036EFA&w=960",
            "https://cdn.jumeirah.com/api/public/content/cc3515f7de5e4bd885c3f18dc6fef1ed?v=44511fed",
            "https://i.assetzen.net/i/HLgQIkXrps6i/w%3A600/h%3A400/q%3A70.webp",
            "https://stat.ameba.jp/user_images/20140627/18/taiwan-kannkou/2c/ca/j/o0800120012985999286.jpg",
            "https://europeanspamagazine.com/app/uploads/2023/11/city-of-dreams_84854.jpg",
            "https://www.luxspa.in/img/Header1_massage.jpeg",
            "https://pannello.eurotoursitalia.it/menu/gestione_offerte/images/offerte/big/600w/11236g_8.jpg",
            "https://www.moselschloesschen.de/media/47819015-19fb-42bf-8873-1673a33b65d1.jpg?w=1500",
            "https://img.nh-hotels.net/ae1LZ/Oq1gJK/original/NH_Collection_Santiago_Massage_Treatments.jpg?background-color=white&composite-to=center%2Ccenter%7C555%3A280&output-quality=70&resize=555%3A%2A",
            "https://static.wixstatic.com/media/nsplsh_52f86b9619d0487a822d0f6241caa113~mv2.jpg/v1/fill/w_2500%2Ch_1666%2Cal_c/nsplsh_52f86b9619d0487a822d0f6241caa113~mv2.jpg",
            "https://images.squarespace-cdn.com/content/v1/5e8b2954f1dbb3793474f21e/1588094667277-RJ2RE6BTE8IH7F5Z18X3/IMG_5811.jpg"
    };

    private static final String[] SKIN_IMAGES = {
            "https://www.hoejholthudpleje.dk/cdn/shop/files/hudpleje_teenager_ansigtsbehandling_4.jpg?v=1772880083&width=1080",
            "https://supremeboutiquespa.com/cdn/shop/products/Ice_sSecretAcne_PoreFacial.jpg?v=1658291064",
            "https://product.hstatic.net/200000082277/product/nan_mun_2_d6b167d3f11d4819b6125255f81860cd.jpg",
            "https://images.wantedly.com/i/JTWH1zJ?w=940",
            "https://live.staticflickr.com/2888/9865582355_df71d00c02_b.jpg",
            "https://138836648.cdn6.editmysite.com/uploads/1/3/8/8/138836648/DRAOYML3H5P3N2RTEEA3LK3U.png",
            "https://www.contextskin.com/cdn/shop/articles/Articles_2026_skin_essentials_4.webp?v=1769610159&width=1100",
            "https://imgbp.hotp.jp/CSP/IMG_SRC_K/65/99/C032036599/C032036599.jpg?h=406&impolicy=HPB_policy_default&w=540"
    };

    private static final String[] MAKEUP_IMAGES = {
            "https://v4i.rweb-images.com/www.browtiful-sirscalpphuket.com/images/editor/416070137_1044535963492142_2648717820188150624_n_copy_1600x873.png",
            "https://upload.wikimedia.org/wikipedia/commons/a/ab/Microblading_de_Cejas.png",
            "https://media.socialdeal.nl/deal/beauty-by-behnaz-26021615353199.jpg",
            "https://images.squarespace-cdn.com/content/v1/5d58584790897700016dccee/87f04ece-8563-49e2-b959-afffa3432514/InShot_final.jpg",
            "https://cdn1.treatwell.net/images/view/v2.i13559749.w1080.h720.x37428FCB/",
            "https://cdn.prod.website-files.com/5f611d59240a3a5f4497d366/60043b89c6d989b5ac10bd7b_Caka-Cosmetics-Mannheim-Kosmetikschule-Nr-1-Kombipakete.jpg",
            "https://images.fresha.com/locations/location-profile-images/2755426/5402379/47150dfb-6c13-4be7-a6a4-596f0889f577-ThePerfectFace-FR-le-de-france-Longpont-sur-orge-Fresha.jpg",
            "https://primary.jwwb.nl/public/u/v/u/temp-zuawhertxnqquzklrbhi/20220206_003032-high.jpg?crop=1%3A1&enable=upscale&enable-io=true&width=800",
            "https://upload.wikimedia.org/wikipedia/commons/e/e6/Eyelash_Extension_Picture.jpg",
            "https://static.wixstatic.com/media/41dd1f_b658b4171f974820a1c6a73c6cec5a31~mv2.webp/v1/fit/w_2500%2Ch_1330%2Cal_c/41dd1f_b658b4171f974820a1c6a73c6cec5a31~mv2.webp",
            "https://static.glossgenius.com/public/service/d159bdc6ee420e7502798fa56d5a19a343f18596/image/c021a95cd689984fdcfe3d9dbe4126fa.jpg",
            "https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=85",
            "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=85",
            "https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=900&q=85"
    };

    record PartnerEntry(String slug, String name, String ownerName, String practitionerName,
                        String businessType, String address, String description, List<ServiceEntry> services) {}

    record ServiceEntry(String categorySlug, String name, long price, int durationMinutes,
                        String description, String highlightText, String imageUrl) {}
}
