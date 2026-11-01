//import { useEffect, useState } from "react";
//import Carousel from "../../components/Carousel/Carousel";
//import FeaturedPost from "../../components/FeaturedPost/FeaturedPost"
import LatestPosts from "../../components/LatestPosts/LatestPosts";
//import VideoPlayer from "../../components/VideoPlayer/VideoPlayer";
import FeaturedPost from "../../components/FeaturedPost/FeaturedPost";
import styles from "./HomePage.module.css";



const HomePage = () => {

  return (
       <main className={styles.contentContainer}>
        <FeaturedPost/>
      {/* <div className={styles.carouselContainer}>
        <Carousel slides={carouselSlide} autoSlide={true} interval={5000} />
      </div> */}
      <section className={styles.section}>
        <div className={styles.latestPosts}>
      <LatestPosts />
      {/*         <VideoPlayer /> */}
        </div>
      </section>
    </main>
  );
};

export default HomePage;